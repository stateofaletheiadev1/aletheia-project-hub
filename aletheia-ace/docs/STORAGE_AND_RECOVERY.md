# Storage and recovery

## What is stored where

| Category | Where | Durable? |
| --- | --- | --- |
| StableChain source | GitLab (authoritative); ACE checkout in `checkout_dir` | GitLab |
| ACE source | `aletheia-ace/` in this repository | Git |
| Compiled binaries | `output_dir` with `provenance.json`, `SHA256SUMS`; GitHub artifact `stablechain-bin-<commit>` (7 days) | rebuildable from the commit |
| Build dependencies | Cargo registry cache (GitHub `actions/cache`); compiled output is never cached | disposable |
| Runtime configuration | `ace.toml`, node TOML: reviewed in Git | Git |
| Live chain database | the node's `data_dir` | only as durable as the disk under it |
| Recovery checkpoints | `checkpoint_dir`; GitHub artifact `checkpoint` (7 days) | see below |
| Logs | `state_dir/node.log` (+ `.1`), `build.log`, diagnostics artifact | bounded, disposable |
| Secrets | environment / GitHub secrets only | never in files ACE writes |

Git is not a database: ACE never commits a data directory, and never treats an artifact or cache
as a mounted, transactional store.

## Persistence classes

| Class | When | Reported as |
| --- | --- | --- |
| `EPHEMERAL_MODE` | `mode = "ephemeral"`, or any GitHub-hosted runner | the node is never READY, only EPHEMERAL_MODE |
| `PERSISTENCE_UNAVAILABLE` | `persistent-host` requested on a hosted runner or on tmpfs/ramfs | refused before start |
| `PersistentDeclared` | `persistent-host` on another host with a disk filesystem | READY possible; "declared", never "measured" |

## Checkpoints

StableChain has no operator snapshot export/import at the audited commit (audit F22). The
supported way to move a node is a cold copy of its whole data directory while it is stopped (F23).
An ACE checkpoint is that copy, made verifiable:

1. **Take the node's `LOCK`.** If a node holds it, refuse. While ACE holds it, no node can start
   on the directory. A running database is never copied.
2. **Read identity** from `DATADIR.txt`: chain id, genesis id, network, storage schema,
   last writer release, last finalized height, hash and state root. Refuse during a migration.
3. **Walk the directory**: regular files and directories only (a symlink is refused); `LOCK`
   itself is left out.
4. **Archive** (`tar.gz`, mode 0600, fixed mtime/uid/gid) with the SHA-256 and size of every
   file; re-hash every file afterwards to prove nothing changed.
5. **Manifest** (`.json`): format `ace-checkpoint` v1, creation time, ACE version, source commit,
   `aletheiad` SHA-256, identity, `clean_stop`, archive hash and size, unpacked size, file list,
   origin (host kind, GitHub repository/run/sha).
6. **Read back**: `ace checkpoint` validates what it just wrote.

`clean_stop` is true when ACE saw the node exit 0 at exactly the height `DATADIR.txt` records.
`DATADIR.txt` is only refreshed at a clean stop (F20), so after a crash its height is a lower
bound; such a copy is crash-consistent and the node recovers from it at start-up as it would after
the crash itself. ACE's workflows only take checkpoints after a clean stop.

## Validation

`ace validate-snapshot` (and every restore) checks, in order: format and version; network, chain
id and pinned genesis id; storage schema against the pinned source's `BINARY_STORAGE_SCHEMA`; no
migration in progress; size within `max_snapshot_mb`; archive SHA-256 and size; then every entry:
under `data/`, only normal path components (no `..`, no absolute paths), only files and
directories (no links, devices, FIFOs), size and SHA-256 as listed, nothing extra, nothing
missing.

Trust model: the hashes prove the bytes are those the manifest lists. They do not prove who made
the manifest or that the chain in it is honest. Provenance (`origin`) is recorded, not signed.
What protects the chain is the node itself: at start it verifies its WAL, re-verifies the archived
tip block and its state root (recovery.md), and refuses a directory for another chain (F19). After
a restore, `ace verify-restore` checks the running node is at or above the checkpoint height and
that its state root at that height equals the recorded one.

## Restore

`ace restore-snapshot <manifest|latest> --yes`:

- refuses if the node runs, if `data_dir` exists and is not empty, or if a previous restore left
  a staging directory (`.<name>.ace-restore-*`, never removed automatically);
- validates fully, checks free space (unpacked size + 64 MiB);
- extracts into a staging directory beside `data_dir` (same filesystem), files 0600, hashing as it
  writes; on any error removes only its own staging directory;
- compares the staged `DATADIR.txt` with the manifest identity;
- renames staging to `data_dir` in one step.

`latest` picks the highest-height valid checkpoint in `checkpoint_dir`, logging why each skipped
one was skipped. ACE never overwrites a working directory, never changes network, never resets
or re-initializes a chain because a restore failed.

## Disk safety

- Build: stopped if the target directory's filesystem drops below `[build] min_free_disk_mb`.
- Run: the node is not started below `[limits] min_free_disk_mb`; while running, ACE stops it
  cleanly when free space drops below that floor and does not restart it.
- Checkpoint: needs twice the data size free; restore needs the unpacked size plus 64 MiB.
- Nothing is deleted to make room.

## Measured growth (empty devnet blocks, audited commit)

| Height | Data directory |
| --- | --- |
| 0 (fresh) | 208-268 KB |
| 42 | 864 KB (includes RocksDB start-up files) |
| 185 | 399 KB (after RocksDB compaction of the start-up files, a different run) |
| 251 | 460 KB: `state/` 388 KB, `blocks/` 50 KB, `wal/` 29 KB |

Between heights 185 and 251 the directory grew about 0.9 KB per block, roughly 200 B in `blocks/`
and 110 B in `wal/`. At two blocks a second that is on the order of 150 MB a day for empty blocks;
growth with transactions is not measured (audit F33). The checkpoint at height 251 was 68 KB
compressed.
