# Operations

Production: the **kortana-web** Oracle VPS (Ubuntu 24.04, x86-64, 1 GB RAM shared with the
Kortana website). The server also has `/srv/aletheiadb/README` describing the same layout.

| Item | Where |
|---|---|
| Binary | `/srv/aletheiadb/bin/aletheiadb` (previous release: `aletheiadb.previous`) |
| Config and secrets | `/srv/aletheiadb/config/aletheiadb.env` (root:aletheiadb, 0640) |
| Data | `/srv/aletheiadb/data/aletheia.redb` on its own 50 GB block volume (`aletheiadb-data`) |
| Service | `aletheiadb.service`: user `aletheiadb`, memory capped at 250 MB, hardened, starts only if the data volume is mounted |
| Listen | `127.0.0.1:7790` only |
| Public door | nginx `/etc/nginx/sites-available/aletheiadb`: TLS (Let's Encrypt, auto-renewed), 30 req/s per client, 1 MB bodies |
| Root key | `/root/aletheiadb-root.key` (root only, 0600); only its SHA-256 is in the env file |
| Logs | `journalctl -u aletheiadb` (JSON, one line per request, never bodies) |

## Everyday commands

```sh
systemctl status aletheiadb
journalctl -u aletheiadb -n 50 -o cat
curl -s https://db.stateofaletheia.org/health/ready
```

## Deploy and roll back

```sh
SSH_KEY=/path/to/key deploy/deploy.sh            # from aletheia-db/
# roll back on the server:
sudo cp -a /srv/aletheiadb/bin/aletheiadb.previous /srv/aletheiadb/bin/aletheiadb && sudo systemctl restart aletheiadb
```

## API keys

On the server (the root key never leaves it):

```sh
K=$(sudo cat /root/aletheiadb-root.key)
curl -s -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -X POST https://db.stateofaletheia.org/v1/keys \
  -d '{"name":"gov-site (Vercel)","database":"gov","role":"readWrite"}'
unset K
```

The response shows the new key once. Put it in the application's server-side secrets as
`ALETHEIADB_URL=aletheiadb://<id>:<secret>@db.stateofaletheia.org/gov`. Revoke with
`DELETE /v1/keys/<id>`.

**Rotating the root key:** run `aletheiadb keygen` on the server, replace the hash in the env
file and the key in `/root/aletheiadb-root.key`, then `systemctl restart aletheiadb`.

## Backups and restore

The data file is a single redb file; every commit is durable before the API answers.

- **Volume backups** (recommended): in Oracle, Storage, Block Volumes, `aletheiadb-data`,
  Backups. Always Free includes 5 volume backups in total.
- **File copy**: `sudo systemctl stop aletheiadb && sudo cp -a /srv/aletheiadb/data/aletheia.redb <dest> && sudo systemctl start aletheiadb`.
- **Restore**: stop the service, put the file back at `/srv/aletheiadb/data/aletheia.redb`
  owned by `aletheiadb`, start the service, check `/health/ready`.

## Moving to a bigger server

Stop the service, unmount `/srv/aletheiadb/data`, detach the volume in Oracle, attach it to the
new instance, mount it, install the same unit, env file and binary, and point
`db.stateofaletheia.org` at the new address.

## Memory

At idle the process uses about 1–2 MB; the page cache is capped at 64 MB
(`ALETHEIADB_CACHE_MB`) and the whole service at 250 MB by systemd.
