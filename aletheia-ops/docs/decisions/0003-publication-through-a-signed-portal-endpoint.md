# ADR 0003: Publication through a signed endpoint on the portal

- Status: Accepted (owner decision D2, 15 October 2026)
- Date: 2026-10-15

## Decision

- The portal gains `POST /api/publications` and `GET /api/publications/{idempotencyKey}`
  (backend only; no visual change). It is the only writer of published records in `gov`.
- Authentication: HMAC-SHA256 over `METHOD \n PATH \n TIMESTAMP \n SHA256(body)`, sent as
  `Authorization: AGV-HMAC keyId=…, ts=…, sig=…`. Requests older or newer than 300 s are refused.
  Two keys can be active at once for rotation. Secrets live only in server environment variables
  of both projects.
- The portal re-validates the payload per register, recomputes the content hash and refuses a
  mismatch, refuses a reused idempotency key with a different body, and stores a receipt.
- The workbench never holds a key that can write the public record.
- Content hash: SHA-256 (hex) of the canonical JSON (RFC 8785 style: sorted keys, no
  insignificant whitespace, UTF-8) of `{register, reference, title, summary, body, facts,
  version}`. The same function is used by both apps and is unit-tested with shared vectors.
- Until the endpoint is deployed, the `PublicationGateway` has a development adapter that only
  runs with `PUBLICATION_MODE=development`, shows a persistent banner, marks receipts as
  simulated, and refuses to start in a production build.
