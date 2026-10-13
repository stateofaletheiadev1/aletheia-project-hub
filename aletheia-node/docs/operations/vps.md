# Running aletheiad on a VPS

This is the operator's path from an empty Linux VPS to a node that survives crashes, reboots and
memory pressure, with or without swap. Everything here was exercised by
`scripts/e2e_crash_recovery.sh` (see "What was tested" at the end).

## Before you start: which network

`aletheiad` refuses plaintext node and consensus keys on every network except `devnet` and
`regtest` (spec Section 19.2). Until the remote signer is wired in (spec phase 5), a node on
this VPS runs a devnet or regtest chain. This is deliberate: it is what stops a production
validator key from ever sitting in a file.

## 1. Build

On the build machine (or the VPS itself, 2 GB RAM or more for the build):

```sh
cd aletheia-node
cargo build --release --locked -p aletheiad -p aletheia-arno-exec -p aletheia-cli
# A devnet with a block producer instead of validators:
cargo build --release --locked -p aletheiad --features devnet-producer
```

Install `target/release/aletheiad`, `aletheia-arno-exec` and `aletheia-cli` to
`/usr/local/bin/`. The contract executor must sit beside `aletheiad` (or set
`[execution] executor_path`).

## 2. User, directories, configuration

```sh
useradd --system --home /var/lib/aletheia --shell /usr/sbin/nologin aletheia
install -d -o aletheia -g aletheia -m 0700 /var/lib/aletheia
install -d -m 0755 /etc/aletheia
# genesis.toml, node.toml and the node key go in /etc/aletheia; the key readable by the
# aletheia user only:
chown root:aletheia /etc/aletheia/node.key && chmod 0640 /etc/aletheia/node.key
```

`/etc/aletheia/node.toml` (see `apps/aletheiad/src/config.rs` for every key):

```toml
[node]
data_dir = "/var/lib/aletheia"
genesis = "/etc/aletheia/genesis.toml"
listen = "0.0.0.0:7771"
node_key_file = "/etc/aletheia/node.key"

[rpc]
# Keep RPC on loopback; publish it through a reverse proxy (TLS, connection limits).
listen = "127.0.0.1:7781"

# Optional. Without it the node sizes itself from the memory it may use (see section 4).
#[storage]
#block_cache_mb = 128
#write_buffer_mb = 128
```

## 3. systemd and kernel settings

```sh
install -m 0644 deploy/systemd/aletheiad.service /etc/systemd/system/
install -m 0644 deploy/sysctl/99-aletheia.conf /etc/sysctl.d/
sysctl --system
systemctl daemon-reload
systemctl enable --now aletheiad
journalctl -u aletheiad -f
```

The unit restarts the node after a crash, a kill or a fail-stop (exit 70), but not after the
exits that restarting cannot fix (64 usage, 75 needs a newer release, 78 configuration). Three
fail-stops in ten minutes keep it down for you to look at (`exit-codes.md`). It runs the node
as `aletheia` with a read-only system, private `/tmp` and no capabilities.

## 4. Memory, with and without swap

What the node uses, and how it sizes itself:

| Use | Default size | Setting |
| --- | --- | --- |
| RocksDB block cache (one, shared by every column family) | 1/8 of the memory the node may use, 64 to 512 MiB | `[storage] block_cache_mb` |
| RocksDB memtables, all column families together | same as the cache, at most 256 MiB | `[storage] write_buffer_mb` |
| Mempool | 1/16 of that memory, 32 to 200 MiB | automatic |
| Each contract worker (sandboxed process) | capped at 1 GiB address space; metered use is at most 32 MiB per transaction | fixed |

"The memory the node may use" is physical RAM, or the limit of its control group if lower
(Docker's `--memory`, or `MemoryMax=` in the unit). Swap is never counted: a cache that lives
in swap is slower than no cache.

**Without swap.** Size the VPS so the defaults fit with room to spare: 1 GiB RAM runs a devnet
node (128 + 128 MiB RocksDB, 64 MiB mempool); 2 GiB or more is comfortable; 4 GiB or more for a
long-lived chain with real traffic. If the kernel's OOM killer does strike, the unit restarts
the node and it continues from its last finalized block (section 5). `OOMScoreAdjust=-800`
makes the kernel pick other processes first.

**With swap.** Add swap if you like headroom; nothing in the node depends on it either way:

```sh
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

`vm.swappiness = 10` (from `99-aletheia.conf`) makes the kernel drop file cache before it swaps
the node out. A swapped node is slower but stays correct: rounds are retried by timeout, and
every transaction is bounded to about half a second of execution, twenty times under the
contract watchdog (ADR-061), so a slow or swapping node finishes everything a fast one does.
To set a soft ceiling, uncomment `MemoryHigh=` in the unit (about 85 % of RAM): above it the
kernel reclaims the node's caches before anything is killed.

## 5. Crash recovery: stop, fix, continue

The node commits each finalized block durably (RocksDB with synced writes, plus its own WAL)
before it reports it final. After any stop, clean or not:

```sh
systemctl stop aletheiad        # or a crash, kill -9, power loss, OOM kill
# ... change the configuration, install a new binary, resize the VPS ...
systemctl start aletheiad
aletheia-cli --rpc 127.0.0.1:7781 status    # finalized height continues from where it was
```

Recovery runs at start-up and resumes at the last finalized height; blocks already finalized
never change. Transactions that were still pending in the mempool when the node stopped are
not kept (the mempool lives in memory, as on most chains): wallets resubmit them, and their
nonce is still free. A `stopped cleanly finalized_height=…` line means a clean stop;
`fail-stop: …` names the error and recovery runs on the next start.

Never copy a data directory between machines while the node is running, and never edit one by
hand. To move a node, stop it, copy `/var/lib/aletheia` whole, and start it on the new host.

## 6. Upgrades

Stop, install the new binaries, start. A release that needs a newer protocol version than the
binary supports stops with exit 75 at the activation height; install that release and start
again: it continues from the same height.

## 7. Security checklist

- RPC listens on loopback; anything public goes through a reverse proxy with TLS, request size
  and connection limits. The node also limits each client IP (50 calls a second by default; a
  JSON-RPC batch counts every call).
- P2P (7771) is the only port the node needs open. Peers are authenticated (TLS 1.3 plus a
  signed handshake); misbehaving peers are banned by key and, briefly, by address.
- Keep `/etc/aletheia/node.key` at `0640 root:aletheia`; never put production keys in files.
- Keep the system updated; the unit's sandboxing does not replace that.

## What was tested

`scripts/e2e_crash_recovery.sh` runs a RocksDB-backed devnet node under continuous transfers,
kills it with SIGKILL at random moments, restarts it, and checks that it resumes at or above
its height with every earlier block and state root unchanged, that every finalized transfer
used exactly one nonce, and that total AEY never changes. On 2026-10-13 it passed:

- unconstrained (8 crash cycles, 384 transfers finalized);
- inside a control group with a hard 256 MiB limit and no swap (the node sized itself to a
  64 MiB cache and 64 MiB of memtables; no limit hits, no OOM kill);
- inside a control group limited to 8 MiB of RAM with 1 GiB of swap, so the processes were
  forced into swap (3,415 limit hits, 838 major page faults, no OOM kill, every check passed).

Run it on the VPS after installing, before trusting the node:

```sh
bash scripts/e2e_crash_recovery.sh 6 target/release
```
