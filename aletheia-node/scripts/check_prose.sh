#!/usr/bin/env bash
# Fails on filler words banned in docs and UI copy (spec Section 3.4, ADR-025).
# The master specification is exempt: it quotes the list.
set -euo pipefail
cd "$(dirname "$0")/.."

banned="seamless|robust|leverage|delve|cutting-edge|revolutionary|empower|unlock|elevate|supercharge|game-changer|in today's fast-paced world|it's worth noting|harness the power"
hits=$(grep -rnIiwE "$banned" --include='*.md' --exclude-dir=target . \
  | grep -v '^./docs/spec/MASTER.md:' || true)

if [[ -n "$hits" ]]; then
  echo "check_prose: banned filler words found:"
  echo "$hits"
  exit 1
fi
echo "check_prose: ok"
