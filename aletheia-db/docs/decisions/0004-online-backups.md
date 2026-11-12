# 0004: Online backups

Status: Accepted, 2026-11-12

## Context

The government's records (aletheiagov.org, the operations workbench, the citizen portal) live
in one redb file on one block volume. The only documented backups were Oracle volume backups
(manual, five in total on Always Free) and a file copy that needs the service stopped, because
the server holds the file's exclusive lock. Nothing ran on its own, and nothing checked that a
copy could be restored.

## Decision

1. The server backs itself up. One read transaction, a consistent snapshot while writes
   continue, is copied table by table into a new redb file, committed in batches of 5,000
   rows so the copy stays inside the service's 250 MB memory cap.
2. Every copy is verified before it counts: the new file is reopened, and its rows per table
   and content digest must equal those taken while reading the snapshot. The digest is
   SHA-256 over every table and row in key order, length-prefixed, so it names the data, not
   redb's page layout. Only then is the file renamed from `.partial` into place beside a JSON
   manifest; a failed copy leaves nothing behind.
3. `ALETHEIADB_BACKUP_DIR` (refused inside the data directory), `ALETHEIADB_BACKUP_EVERY_HOURS`
   (1 to 168, default 24) and `ALETHEIADB_BACKUP_KEEP` (1 to 90, default 7). The first backup
   runs five minutes after start. Older backups beyond the count are deleted, oldest first;
   other files in the folder are never touched. One backup runs at a time.
4. `GET` / `POST /v1/admin/backups` (root key only) list the backups or make one now; a request
   while one is running is a conflict (409). `aletheiadb verify-backup <file>` checks a copy
   offline against its manifest, wherever it has been moved.
5. Backups are not encrypted by the server: personal data is already encrypted by the
   applications before it is written, and API keys are stored as hashes. Off-site copies are
   the operator's step until an off-site target with its own credentials is chosen.

## Consequences

A daily, verified, restorable copy on a different disk from the data, with no downtime. A
backup on the same server does not survive losing the server: off-site copies remain needed.
Tests (`tests/backup.rs`): restore round trip, snapshots taken while 400 writes land, rotation
that leaves foreign files alone and no partial files, tampered manifest or data refused, and the
API's root-only access, conflict and "not configured" answers.
