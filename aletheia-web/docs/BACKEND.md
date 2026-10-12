# Portal and officer console backend

The Citizen Portal (`/portal`) and the Officer Administration console (`/admin`) run on
**AletheiaDB**. Every page reads and writes through the API routes under `app/api/portal` and
`app/api/admin`; nothing is kept in the browser except an HttpOnly session cookie.

Without `ALETHEIADB_URL` both areas show "not open yet" (`components/layout/ServiceNotOpen.tsx`).

## Set up

1. **Database and keys.** On the AletheiaDB server (see `aletheia-db/docs/OPERATIONS.md`), with the root key:

   ```sh
   curl -X PUT  https://db.stateofaletheia.org/v1/databases/web -H "Authorization: Bearer root.$ROOT"
   curl -X POST https://db.stateofaletheia.org/v1/keys -H "Authorization: Bearer root.$ROOT" \
        -d '{"name":"web-admin","database":"web","role":"admin"}'      # for the bootstrap only
   curl -X POST https://db.stateofaletheia.org/v1/keys -H "Authorization: Bearer root.$ROOT" \
        -d '{"name":"web-site","database":"web","role":"readWrite"}'   # for the running site
   ```

   A key `<id>.<secret>` becomes `aletheiadb://<id>:<secret>@db.stateofaletheia.org/web`.

2. **Collections and indexes** (idempotent, safe to re-run when the schema grows):

   ```sh
   ALETHEIADB_ADMIN_URL=aletheiadb://<admin id>:<secret>@db.stateofaletheia.org/web npm run db:bootstrap
   ```

3. **First administrator** (refuses once one exists; later officers are created in the console under Settings):

   ```sh
   BOOTSTRAP_PASSPHRASE='a long temporary passphrase' \
   ALETHEIADB_URL=aletheiadb://<site id>:<secret>@db.stateofaletheia.org/web \
     npm run officer:bootstrap -- registrar@example.org "Full Name"
   ```

   It prints the officer ID (`SEC-OFFICER-0001`) and an authenticator secret. Add the secret to
   an authenticator app (Google Authenticator, 1Password, …): every officer sign-in needs the
   passphrase **and** the six-digit code. Change the passphrase in Settings after the first sign-in.

4. **Run the site** with `ALETHEIADB_URL` (the readWrite key) in its server environment. It is
   read on the server only and never sent to the browser.

## What is stored

| Collection | Holds |
|---|---|
| `accounts` | Portal accounts: Aletheia ID, email, scrypt passphrase hash, status (registered, e-resident, citizen), residency, national ID and passport number, public identity key, AEY balance, lockout state |
| `officers` | Console accounts: officer ID, passphrase hash, TOTP secret, role (administrator or officer) |
| `sessions` | SHA-256 of each session token, owner, idle timeout and absolute expiry |
| `applications` | E-residency and citizenship applications and their decisions |
| `citizens` | The citizen registry (national ID, passport number, status, SHA-256 of the enrolment record) |
| `companies` | Company formations and their review state |
| `documents`, `file_chunks` | Issued certificates and submitted documents (files up to 4 MB, stored in 150 KB chunks, checked against their SHA-256 on every download) |
| `notifications` | Messages to portal users |
| `wallet_transfers`, `wallet_entries` | AEY transfers between portal accounts and each wallet's ledger |
| `border_crossings` | Border decisions recorded at the console |
| `rescissions` | Citizenship rescission proceedings |
| `audit_events` | Every decision, sign-in and failed sign-in, with a SHA-256 of the event |
| `settings`, `counters` | Console settings (officer session timeout) and reference number sequences |

The schema (collections and indexes) is `lib/server/schema.json`.

## Security

- Passphrases: scrypt (N=2¹⁵, r=8, p=1), at least 12 characters; an unknown ID takes as long to refuse as a wrong passphrase.
- Lockout: portal accounts after 10 failures, officers after 5, for 15 minutes; sign-in is also rate limited per IP.
- Officers: passphrase + TOTP; a code is accepted once (no replay within its 30-second window).
- Sessions: random 256-bit token in an HttpOnly, SameSite=Strict cookie (Secure in production); only its hash is stored; 30 minutes idle (officers: configurable in Settings), 12 hours at most. Changing a passphrase signs out every other session.
- Writes must come from the site itself (Origin / Sec-Fetch-Site check).
- Administrators only: console settings, creating officers, executing or dismissing rescissions.
- Identity keys are Ed25519 pairs made in the browser with WebCrypto. Only the public key is sent; the private key is downloaded by the person.
- AEY balances live in AletheiaDB (not on StableChain). No endpoint creates AEY; balances only move between accounts. A transfer debits and marks the sender in one atomic update, so a transfer interrupted by a crash is finished or marked failed on the next wallet read.

## API

Portal (session cookie `ale_portal_session`):
`POST /api/portal/auth/{register,login,logout}` · `GET|PATCH /api/portal/me` · `POST /api/portal/me/passphrase` ·
`GET /api/portal/dashboard` · `GET|POST /api/portal/applications` · `GET|POST /api/portal/companies`, `PUT /api/portal/companies/{id}` ·
`GET|POST /api/portal/documents`, `GET /api/portal/documents/{id}/file` · `GET|PATCH /api/portal/notifications`, `PATCH /api/portal/notifications/{id}` ·
`GET /api/portal/wallet`, `POST /api/portal/wallet/transfers` · `POST /api/portal/identity/key`

Console (session cookie `ale_officer_session`):
`POST /api/admin/auth/{login,logout}` · `GET /api/admin/me`, `POST /api/admin/me/passphrase` · `GET /api/admin/dashboard` ·
`GET /api/admin/applications?type=`, `POST /api/admin/applications/{id}/decision` · `GET /api/admin/citizens` ·
`GET /api/admin/companies`, `POST /api/admin/companies/{id}/decision` · `GET /api/admin/documents`, `POST /api/admin/documents/{id}/decision`, `GET /api/admin/documents/{id}/file` ·
`GET|POST /api/admin/rescissions`, `POST /api/admin/rescissions/{id}/decision` · `GET /api/admin/activity?category=` · `GET|POST /api/admin/immigration` ·
`GET|PATCH /api/admin/settings` · `GET|POST /api/admin/officers` · `GET /api/admin/security`

Errors are `{"error": "message"}` with the HTTP status (401 not signed in, 403 not allowed, 409 conflict, 503 database unavailable).

## Tests

Both start a throwaway AletheiaDB (`cargo build --release` in `aletheia-db` first, or set `ALETHEIADB_BIN`) and the built site:

```sh
npm run build
npm run test:api                                   # 89 API checks: every endpoint and access rule
CHROMIUM_PATH=/path/to/chrome npm run test:ui      # the whole flow in a real browser
```

## Known limits

- AletheiaDB indexes match exact values only, so date ranges and "latest first" lists scan the
  collection, and the database refuses a query that would examine more than 50,000 documents.
  The audit trail (`audit_events`) is the collection that will reach this first; before it does,
  add archiving or paging by period.
- Decisions write several records one after another (the decision, the registry entry, the
  certificate, the notification). AletheiaDB has no multi-document transactions, so a database
  outage in the middle can leave a decision recorded without, for example, its notification.
  The decision itself is always written first and is never applied twice.
