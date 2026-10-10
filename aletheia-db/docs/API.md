# AletheiaDB HTTP API (v1)

Base URL: `https://db.stateofaletheia.org`. Bodies are JSON. Every response carries
`X-Request-Id` (send your own to correlate logs) and `Cache-Control: no-store`.

## Connection string

```
aletheiadb://<keyId>:<secret>@<host>[:<port>]/<database>[?tls=true&timeoutMs=10000]
```

TLS is on by default (port 443). `tls=false` is accepted only for `localhost`.
The client turns this into `https://<host>` and `Authorization: Bearer <keyId>.<secret>`.

## Authentication and roles

`Authorization: Bearer <keyId>.<secret>` on every `/v1` request.

| Key | Can do |
|---|---|
| root (`root.<secret>`) | Everything, including databases and API keys. Its hash lives in the server environment, not in the database. |
| `admin` (one database) | read + write + create collections and indexes |
| `readWrite` (one database) | read + insert, update, replace, delete |
| `read` (one database) | get, query, count |

A key scoped to one database gets `Forbidden` for any other database.

## Errors

```json
{ "error": { "code": "Conflict", "message": "…" }, "requestId": "…" }
```

| Code | HTTP | Meaning |
|---|---|---|
| `Invalid` | 400 | Bad input; fix the request |
| `Unauthorized` | 401 | Missing or wrong key |
| `Forbidden` | 403 | Valid key, not allowed |
| `NotFound` | 404 | Database, collection, document or route does not exist |
| `Conflict` | 409 | Revision mismatch, unique value taken, or reused Idempotency-Key |
| `Internal` | 500 | Server fault (details only in server logs) |
| `Unavailable` | 503 | Not running or overloaded; retry |
| `Timeout` | 504 | Took longer than 15 s; outcome unknown, retry writes with the same Idempotency-Key |

## Health

| | |
|---|---|
| `GET /health` | `{"status":"ok","version":…}` (no key needed) |
| `GET /health/ready` | storage check, root-key state, history mirror state |

## Databases, collections, indexes

| Method and path | Role | Body | Result |
|---|---|---|---|
| `GET /v1/whoami` | any | | key id, role, database |
| `GET /v1/databases` | any | | databases visible to the key |
| `PUT /v1/databases/{db}` | root | | 201 created / 200 existed |
| `GET /v1/databases/{db}/collections` | read | | collections |
| `PUT /v1/databases/{db}/collections/{coll}` | admin | | 201 / 200 (idempotent) |
| `GET /v1/databases/{db}/collections/{coll}/indexes` | read | | indexes |
| `PUT /v1/databases/{db}/collections/{coll}/indexes/{field}` | admin | `{"unique": true}` | 201 / 200; builds over existing documents |

Names: 1–64 characters, lowercase letters, digits, `_` or `-`, starting with a letter.
Collections must be created before documents are written to them.

## Documents

Every document gets `_id` (time-ordered UUIDv7), `_rev` (starts at 1), `_createdAt` and
`_updatedAt` (UTC, RFC 3339). Clients cannot write these. Limits: 256 KB per document, field
names without `.` and not starting with `$`, nesting depth 32.

| Method and path | Role | Body | Result |
|---|---|---|---|
| `POST …/{coll}/documents` | readWrite | `{"document": {…}}` | 201 `{"document": …}` |
| `GET …/{coll}/documents/{id}` | read | | `{"document": …}` |
| `PATCH …/{coll}/documents/{id}` | readWrite | `{"expectedRev": n, "update": {"$set": {…}, "$unset": […], "$inc": {…}}}` | updated document |
| `PUT …/{coll}/documents/{id}` | readWrite | `{"expectedRev": n, "document": {…}}` | replaced document |
| `DELETE …/{coll}/documents/{id}?expectedRev=n` | readWrite | | `{"_id": …, "deleted": true}` |
| `POST …/{coll}/query` | read | `{"filter": {…}, "sort": {"field": -1}, "limit": 100, "skip": 0}` | `{"documents": […], "hasMore": bool}` |
| `POST …/{coll}/count` | read | `{"filter": {…}}` | `{"count": n}` |

**Revisions.** Updates, replaces and deletes must state the revision they read. If the document
changed since, the server answers `Conflict` and changes nothing: a concurrent edit is never
silently overwritten.

**Idempotency.** Send `Idempotency-Key: <unique string>` on writes. A retry with the same key and
the same request returns the first result (`Idempotent-Replayed: true`) without writing again; the
same key with a different request is a `Conflict`. Keys are remembered for 24 hours. The record
is committed in the same transaction as the write.

## Filters

```json
{ "status": "open", "age": { "$gte": 18, "$lt": 65 }, "tags": { "$in": ["a", "b"] },
  "$or": [ { "city": "Antioch" }, { "remote": true } ], "deletedAt": { "$exists": false } }
```

Operators: `$eq $ne $gt $gte $lt $lte $in $nin $exists`, plus `$and` / `$or` at any level.
Dotted paths reach into nested objects. A plain value on an array field matches any element.
Comparisons hold only between two numbers or two strings.

Sorting: up to 3 fields, `1` ascending or `-1` descending; ties break by `_id` (creation order).
`limit` 1–1000 (default 100), `skip` 0–10 000.

**Indexes.** When the filter pins an indexed field to values (`{"email": "x"}` or `$in`), the
index supplies the candidates. Otherwise the collection is scanned; a query that would examine
more than 50 000 documents is refused with `Invalid` and a hint to add an index. Arrays index
each element. Unique indexes refuse a second document with the same value.

## API keys (root only)

| Method and path | Body | Result |
|---|---|---|
| `POST /v1/keys` | `{"name": "gov-site", "database": "gov", "role": "readWrite"}` | 201 with `key` (shown once) |
| `GET /v1/keys` | | ids, names, databases, roles (never secrets or hashes) |
| `DELETE /v1/keys/{id}` | | revoked immediately |
