# Recovery after a crash or fail-stop

`aletheiad` recovers by itself at start-up (spec Section 24.3). There is nothing to run by hand:
start the node again (systemd does it, see `vps.md`) and read the log.

## What the node does at start-up

Finalizing a block is four synced steps: WAL `FINALIZE_BEGIN`, archive append, one key-value
batch (state, receipts, indexes, `last_finalized`), WAL `FINALIZE_COMMITTED`. A crash can land
between any two. On start the node:

1. locks the data directory (a second node on the same directory is refused);
2. verifies the WAL: a torn tail from the crash is truncated; anything else refuses to start;
3. reads `last_finalized`, re-verifies its archived block and its state root;
4. reconciles a finalize the crash interrupted: if the key-value commit landed, it records
   `FINALIZE_COMMITTED`; if only the archive append landed, it re-executes the archived block
   and commits it; if neither, the block was never final here and is delivered again by
   consensus or sync;
5. restores the last consensus safety data, so a validator never votes twice in a round.

It never continues from state it has not verified. The `following … finalized_height=…` line
says where it resumed; that height is never lower than the last one it reported final.

## When it does not come back

| Log line | Meaning | What to do |
| --- | --- | --- |
| `fail-stop: STO_CORRUPT …` | A store failed its checksums (disk or filesystem damage). | Check the disk (`dmesg`, `smartctl`). Restore the data directory from a copy taken while the node was stopped, or resync from peers into an empty directory. Never edit the directory by hand. |
| `fail-stop: … WAL …` | The WAL is damaged beyond a torn tail. | As above. |
| `configuration refused: …` | The configuration, genesis or key file was refused. | Fix the file the line names. |
| `stopped cleanly: … protocol version …` (exit 75) | The next height needs a newer release. | Install it and start again. |
| Three fail-stops in ten minutes | systemd stops restarting (`StartLimitBurst=3`). | Read the three `fail-stop:` lines; `systemctl reset-failed aletheiad` once fixed. |

Mempool transactions pending at the crash are not restored; their senders resubmit them, and
their nonces are still unused.

The recovery paths are tested with injected crashes at every step of the finalize path
(`crates/node/tests/recovery.rs`, `--features fault-injection`) and end to end with SIGKILL
under load (`scripts/e2e_crash_recovery.sh`).
