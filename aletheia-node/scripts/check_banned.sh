#!/usr/bin/env bash
# Fails if the retired currency name appears anywhere except the change-history tables of
# docs/spec/MASTER.md (spec v4.0 decision 6). AEY is the Aletheian Guilder.
set -euo pipefail
cd "$(dirname "$0")/.."

banned='Aletheia Euro|Euro Unit'
hits=$(grep -rnIE "$banned" --exclude-dir=target --exclude-dir=.git . \
  | grep -v '^./docs/spec/MASTER.md:' \
  | grep -v '^./scripts/check_banned.sh:' || true)

if [[ -n "$hits" ]]; then
  echo "check_banned: retired currency name found (use 'Aletheian Guilder'):"
  echo "$hits"
  exit 1
fi
echo "check_banned: ok"
