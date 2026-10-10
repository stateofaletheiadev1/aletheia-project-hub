# ADR 0002: Durability now, Git history next

- Status: Accepted
- Date: 2026-10-10

## Context

AletheiaDB is meant to keep an auditable history of public records in GitLab. The government
brief warns that Git history is permanent, so confidential data must be encrypted by the
application before it is written, and erasure works by destroying keys (crypto-shredding).

## Decision

- **v1 (now):** a write is "saved" when it is committed and fsynced to the dedicated volume.
  This is what the API promises today.
- **History mirror (next phase, not built):** a background exporter writes committed changes
  to a Git repository and pushes to a private GitLab project in batches. A write will still be
  acknowledged after the local commit; the mirror's lag will be reported in `/health/ready`,
  and writes will be refused if the lag exceeds a configured bound, so the risk is visible
  and bounded. Separate repositories for public and confidential databases.
- Until then, `/health/ready` reports `"history": "not_configured"`. No document claims
  GitLab-backed history exists.

## Needed from the owner

A private GitLab project for the data history and a deploy token with write access to it.
