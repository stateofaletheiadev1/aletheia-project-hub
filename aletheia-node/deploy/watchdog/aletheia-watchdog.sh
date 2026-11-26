#!/bin/bash
# Liveness watchdog for aletheiad and the explorer (docs/operations/vps.md).
#
# systemd already restarts a node that exits. This covers the case it cannot see: the
# process stays alive but stops serving (RPC socket closed) or stops finalizing blocks.
# Run every minute by aletheia-watchdog.timer. After STRIKES consecutive bad checks the
# service is restarted; the node recovers from its last finalized block at start-up.
#
# Install: /usr/local/sbin/aletheia-watchdog (mode 0755), plus the .service and .timer.
set -u

STATE_DIR=/run/aletheia-watchdog
NODE_UNIT=${ALETHEIA_WATCHDOG_NODE_UNIT:-aletheiad}
NODE_STATUS=${ALETHEIA_WATCHDOG_NODE_STATUS:-http://127.0.0.1:7781/api/v1/network/status}
# Start-up opens RocksDB and took nine minutes on the 1 vCPU Mainnet Beta host: never judge a node
# younger than this.
NODE_GRACE=${ALETHEIA_WATCHDOG_NODE_GRACE:-900}
EXPLORER_UNIT=${ALETHEIA_WATCHDOG_EXPLORER_UNIT:-aletheia-explorer}
EXPLORER_URL=${ALETHEIA_WATCHDOG_EXPLORER_URL:-http://127.0.0.1:3000/}
EXPLORER_GRACE=${ALETHEIA_WATCHDOG_EXPLORER_GRACE:-120}
STRIKES=${ALETHEIA_WATCHDOG_STRIKES:-3}

mkdir -p "$STATE_DIR"

log() { echo "$*"; }

# Seconds since the unit last became active, or -1 when it is not active (systemd's own
# Restart= handles a stopped or crashed unit; the watchdog leaves it alone).
unit_age() {
    systemctl is-active --quiet "$1" || { echo -1; return; }
    local since now
    since=$(systemctl show -p ActiveEnterTimestampMonotonic --value "$1")
    now=$(awk '{printf "%d", $1 * 1000000}' /proc/uptime)
    echo $(( (now - since) / 1000000 ))
}

# strike NAME REASON -> prints the new strike count
strike() {
    local n
    n=$(( $(cat "$STATE_DIR/$1.strikes" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$STATE_DIR/$1.strikes"
    log "$1: check failed ($2), strike $n of $STRIKES"
    [ "$n" -ge "$STRIKES" ]
}

clear_strikes() { rm -f "$STATE_DIR/$1.strikes"; }

restart() {
    log "$1: restarting $2 after $STRIKES failed checks"
    clear_strikes "$1"
    rm -f "$STATE_DIR/$1.height"
    systemctl restart "$2"
}

# --- node: the RPC must answer and the finalized height must rise between checks ---
age=$(unit_age "$NODE_UNIT")
if [ "$age" -lt 0 ] || [ "$age" -lt "$NODE_GRACE" ]; then
    clear_strikes node
    rm -f "$STATE_DIR/node.height"
else
    body=$(curl -s -m 10 "$NODE_STATUS")
    height=$(printf '%s' "$body" | grep -o '"finalizedHeight":[0-9]*' | cut -d: -f2)
    last=$(cat "$STATE_DIR/node.height" 2>/dev/null || echo "")
    if [ -z "$height" ]; then
        strike node "rpc not answering at $NODE_STATUS" && restart node "$NODE_UNIT"
    elif [ -n "$last" ] && [ "$height" -le "$last" ]; then
        strike node "finalized height stuck at $height" && restart node "$NODE_UNIT"
    else
        echo "$height" > "$STATE_DIR/node.height"
        clear_strikes node
    fi
fi

# --- explorer: the page must answer ---
age=$(unit_age "$EXPLORER_UNIT")
if [ "$age" -lt 0 ] || [ "$age" -lt "$EXPLORER_GRACE" ]; then
    clear_strikes explorer
else
    code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$EXPLORER_URL")
    case "$code" in
        2??|3??) clear_strikes explorer ;;
        *) strike explorer "HTTP $code from $EXPLORER_URL" && restart explorer "$EXPLORER_UNIT" ;;
    esac
fi
exit 0
