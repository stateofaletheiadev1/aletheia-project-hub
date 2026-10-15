#!/usr/bin/env bash
# Builds AletheiaDB for Linux and deploys it to the kortana-web VPS (Oracle, Ubuntu x86-64).
# Usage: deploy/deploy.sh            (from the aletheia-db directory)
# Env:   SSH_KEY (path to the instance key), HOST (default ubuntu@155.248.219.32)
set -euo pipefail

HOST="${HOST:-ubuntu@155.248.219.32}"
SSH_KEY="${SSH_KEY:?set SSH_KEY to the instance private key path}"
TARGET=x86_64-unknown-linux-musl
BIN="target/$TARGET/release/aletheiadb"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST")

echo "== build"
cargo build --release --target "$TARGET"
SUM=$(sha256sum "$BIN" | cut -d' ' -f1)
echo "binary sha256 $SUM"

echo "== upload"
scp -i "$SSH_KEY" -o BatchMode=yes "$BIN" "$HOST:/tmp/aletheiadb.new"

echo "== install and restart"
"${SSH[@]}" "bash -s" "$SUM" <<'REMOTE'
set -euo pipefail
SUM="$1"
echo "$SUM  /tmp/aletheiadb.new" | sha256sum -c -
chmod 0755 /tmp/aletheiadb.new  # scp from Windows does not carry the execute bit
/tmp/aletheiadb.new version
if [ -f /srv/aletheiadb/bin/aletheiadb ]; then
  sudo cp -a /srv/aletheiadb/bin/aletheiadb /srv/aletheiadb/bin/aletheiadb.previous
fi
sudo install -o root -g aletheiadb -m 0750 /tmp/aletheiadb.new /srv/aletheiadb/bin/aletheiadb
rm -f /tmp/aletheiadb.new
sudo systemctl restart aletheiadb
for i in $(seq 20); do
  if curl -sf http://127.0.0.1:7790/health >/dev/null; then break; fi
  sleep 0.5
done
curl -sf http://127.0.0.1:7790/health/ready
echo
systemctl is-active aletheiadb
REMOTE

echo "== public check"
curl -sf https://db.stateofaletheia.org/health
echo
echo "deployed. Roll back with: sudo cp -a /srv/aletheiadb/bin/aletheiadb.previous /srv/aletheiadb/bin/aletheiadb && sudo systemctl restart aletheiadb"
