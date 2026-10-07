#!/usr/bin/env bash
# Fails if 0x-prefixed text appears in docs, configs, genesis files or test vectors
# (spec Section 12.2, ADR-021). Rust source may use numeric literals internally and is not
# scanned. Lines that state or test the rule itself are allowed when they name it explicitly:
# "0x prefix", "0x-prefixed", "`0x`", "0x or 0X", "0x/0X". The APS-0048 vectors contain
# 0x-prefixed inputs on purpose: they are the cases proving such text is rejected.
set -euo pipefail
cd "$(dirname "$0")/.."

paths=()
for candidate in docs tests/vectors configs genesis deployments; do
  [[ -e "$candidate" ]] && paths+=("$candidate")
done
[[ ${#paths[@]} -eq 0 ]] && { echo "check_no_0x: ok (nothing to scan)"; exit 0; }

rule_statement='0x prefix|0x-prefixed|`0x`|0x or 0X|0x/0X|0X'
hits=$(grep -rnIE '\b0x[0-9a-fA-F]' "${paths[@]}" \
  | grep -v '^docs/spec/MASTER.md:' \
  | grep -vE '^tests/vectors/APS-0048/[^:]+:[0-9]+: *"text": "0[xX]' \
  | grep -vE "$rule_statement" || true)

if [[ -n "$hits" ]]; then
  echo "check_no_0x: 0x-prefixed text found (use unprefixed lowercase base16 or AL: forms):"
  echo "$hits"
  exit 1
fi
echo "check_no_0x: ok"
