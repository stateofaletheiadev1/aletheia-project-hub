#!/usr/bin/env bash
# End-to-end crash recovery on a real RocksDB-backed devnet node (spec Sections 24, 44.5).
#
#   bash scripts/e2e_crash_recovery.sh [cycles] [bin_dir]
#
# Starts a devnet producer with the development accounts, drives transfers with
# devnet-traffic, and for each cycle kills the node at a random moment (SIGKILL, so nothing is
# flushed on purpose), restarts it and checks:
#   - it comes back at or above the height it had reached, never below;
#   - every block it had finalized keeps the same id and state root;
#   - it produces new blocks again;
# and at the end, after a clean SIGTERM stop and restart:
#   - total AEY across the development accounts is unchanged (transfers move, never create);
#   - every finalized transfer used exactly one nonce (pending ones die with the in-memory
#     mempool at a crash and are simply never applied).
# Exit status 0 means every check passed. NON-PRODUCTION: development keys, devnet only.
set -euo pipefail
cd "$(dirname "$0")/.."

cycles=${1:-6}
bin=${2:-target/debug}
work=$(mktemp -d "${TMPDIR:-/tmp}/aletheia-e2e-XXXXXX")
rpc_port=$((20000 + RANDOM % 20000))
p2p_port=$((rpc_port + 1))
rpc="127.0.0.1:$rpc_port"
cli=("$bin/aletheia-cli" --rpc "$rpc" --output json)
node_pid=""
traffic_pid=""

cleanup() {
  [[ -n "$traffic_pid" ]] && kill "$traffic_pid" 2>/dev/null || true
  [[ -n "$node_pid" ]] && kill -9 "$node_pid" 2>/dev/null || true
}
trap cleanup EXIT

fail() {
  echo "e2e_crash_recovery: FAIL: $*" >&2
  echo "logs kept in $work" >&2
  exit 1
}
say() { echo "e2e_crash_recovery: $*"; }

cat > "$work/node.toml" <<EOF
[node]
data_dir = "$work/data"
genesis = "$PWD/genesis/devnet-explorer.toml"
listen = "127.0.0.1:$p2p_port"
node_key_file = "$PWD/configs/devnet-node.key"

[devnet]
produce_every_ms = 500

[rpc]
listen = "$rpc"
requests_per_second = 1000
EOF

start_node() {
  "$bin/aletheiad" --config "$work/node.toml" >> "$work/node.log" 2>&1 &
  node_pid=$!
  for _ in $(seq 1 120); do
    if "${cli[@]}" status > /dev/null 2>&1; then return 0; fi
    kill -0 "$node_pid" 2>/dev/null || fail "the node exited during start-up (see node.log)"
    sleep 0.5
  done
  fail "the node did not answer RPC within 60 s"
}

height() { "${cli[@]}" status | jq -r '.finalizedHeight'; }
block_fingerprint() { "${cli[@]}" block show "$1" | jq -r '"\(.id) \(.stateRoot)"'; }

wait_for_height_above() {
  local floor=$1
  for _ in $(seq 1 60); do
    local h
    h=$(height 2>/dev/null || echo 0)
    if (( h > floor )); then return 0; fi
    sleep 0.5
  done
  fail "no new block above $floor within 30 s after restart"
}

accounts=$("$bin/devnet-traffic" genesis | sed -n 's/^address = "\(.*\)"$/\1/p' | sort -u)

total_aey() {
  local sum=0
  for a in $accounts; do
    sum=$(python3 -c "print($sum + $("${cli[@]}" balance "$a" | jq -r '.available'))")
  done
  echo "$sum"
}

start_node
expected_total=$(total_aey)
say "node up at height $(height); development accounts hold $expected_total AEY units"

"$bin/devnet-traffic" run "http://$rpc" 150 >> "$work/traffic.log" 2>&1 &
traffic_pid=$!

declare -A seen
for cycle in $(seq 1 "$cycles"); do
  sleep $((3 + RANDOM % 8)).$((RANDOM % 10))
  before=$(height)
  # Fingerprint a spread of finalized blocks, including the tip.
  for h in 1 $((before / 2)) "$before"; do
    (( h >= 1 )) && seen[$h]=$(block_fingerprint "$h")
  done
  kill -9 "$node_pid"
  wait "$node_pid" 2>/dev/null || true
  say "cycle $cycle: killed at height $before"
  start_node
  after=$(height)
  (( after >= before )) || fail "cycle $cycle: restarted at height $after, below $before"
  for h in "${!seen[@]}"; do
    now=$(block_fingerprint "$h")
    [[ "$now" == "${seen[$h]}" ]] || fail "cycle $cycle: block $h changed from '${seen[$h]}' to '$now'"
  done
  wait_for_height_above "$after"
  say "cycle $cycle: resumed at $after, producing again, ${#seen[@]} earlier blocks unchanged"
done

kill "$traffic_pid" 2>/dev/null || true
wait "$traffic_pid" 2>/dev/null || true
traffic_pid=""
sleep 2

# A clean stop must exit 0 and resume exactly where it stopped.
before=$(height)
kill -TERM "$node_pid"
status=0
wait "$node_pid" || status=$?
node_pid=""
(( status == 0 )) || fail "SIGTERM stop exited with $status"
grep -q "stopped cleanly" "$work/node.log" || fail "no 'stopped cleanly' line after SIGTERM"
start_node
after=$(height)
(( after >= before )) || fail "clean restart came back at $after, below $before"
wait_for_height_above "$after"

final_total=$(total_aey)
[[ "$final_total" == "$expected_total" ]] || fail "total AEY changed: $expected_total -> $final_total"

# The mempool lives in memory: transfers still pending when the node was killed are dropped
# and their nonce is never used. Every transfer that did reach a finalized block must account
# for exactly one nonce, no more and no less.
submitted=$(sed -n 's/^sent .*  \(AL:T[0-9a-z]*\)$/\1/p' "$work/traffic.log")
finalized=0
for id in $submitted; do
  if "${cli[@]}" tx show "$id" > /dev/null 2>&1; then finalized=$((finalized + 1)); fi
done
nonces=0
for a in $accounts; do
  n=$("${cli[@]}" account "$a" | jq -r '.nonce')
  nonces=$((nonces + n))
done
(( finalized > 0 )) || fail "no transfer was finalized"
(( nonces == finalized )) || fail "nonces sum to $nonces but $finalized submitted transfers are on chain"
dropped=$(( $(echo "$submitted" | grep -c . || true) - finalized ))

say "PASS: $cycles crash cycles and one clean restart; height $(height); $finalized transfers finalized, one nonce each; $dropped pending at a crash and dropped; total AEY unchanged"
peak_rss_kib=$(sed -n 's/^VmHWM:[[:space:]]*\([0-9]*\) kB$/\1/p' "/proc/$node_pid/status" 2>/dev/null || echo "?")
say "peak resident memory of the last node process: ${peak_rss_kib} KiB"
kill -TERM "$node_pid" 2>/dev/null || true
wait "$node_pid" 2>/dev/null || true
node_pid=""
rm -rf "$work"
