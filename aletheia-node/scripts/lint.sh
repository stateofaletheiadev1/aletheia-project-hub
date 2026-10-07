#!/usr/bin/env bash
# Repository text gates run after cargo fmt/clippy/test (CLAUDE.md work loop step 5).
set -euo pipefail
cd "$(dirname "$0")"

./check_banned.sh
./check_no_0x.sh
./check_prose.sh
