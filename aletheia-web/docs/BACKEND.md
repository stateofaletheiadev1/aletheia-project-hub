# Portal and officer console backend

The Citizen Portal (`/portal`) and the Officer Administration console (`/admin`) run on
**AletheiaDB**. Every page reads and writes through the API routes under `app/api/portal` and
`app/api/admin`; nothing is kept in the browser except an HttpOnly session cookie.

Without `ALETHEIADB_URL` and `DATA_ENCRYPTION_MASTER_KEY` both areas show "not open yet"
(`components/layout/ServiceNotOpen.tsx`).

## Server environment

| Variable | Required | What |
|---|---|---|
| `ALETHEIADB_URL` | yes | `aletheiadb://<id>:<secret>@db.stateofaletheia.org/web`, a readWrite key |
| `DATA_ENCRYPTION_MASTER_KEY` | yes | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts every person's data key. **Back it up separately: without it no personal data can be read.** |
| `PUBLIC_SITE_URL` | in production | e.g. `https://stateofaletheia.org`: links in emails, and the passkey origin |
| `ADMIN_HOST` | no | normally unset: on stateofaletheia.org the console moves to `adss.oiss.stateofaletheia.org` by itself (go-live.md step 6b). Set to override that address, or `off` to keep the console on the main site |
| `WEBAUTHN_RP_ID` | no | passkey relying-party ID; defaults to the host of `PUBLIC_SITE_URL` |
| `SMTP_URL` | for email | e.g. `smtps://user:pass@smtp.example.org:465`. Without it emails wait in the outbox |
| `MAIL_FROM` | no | sender, default `Sovereign Covenant State of Aletheia <no-reply@stateofaletheia.org>` |

## Set up

Step by step, with exact commands: **[go-live.md](go-live.md)**. In short:

1. On the database server, create the `web` database, an admin key (for setup) and a readWrite key (for the site).
2. Write the secrets into git-ignored files; generate and back up `DATA_ENCRYPTION_MASTER_KEY`.
3. `node --env-file=.env.bootstrap.local scripts/db/bootstrap.mjs` creates the collections; then revoke the admin key.
4. `node --env-file=.env.production.local scripts/db/officer-bootstrap.mjs <email> "<name>"` (with `BOOTSTRAP_PASSPHRASE`) creates the first administrator.
5. **Run the site** with the variables above in its server environment. They are read on the
   server only and never sent to the browser.

## What is stored

Personal data is encrypted before it reaches the database (`lib/server/envelope.ts`, the same
scheme as aletheia-gov): each person and each officer has a random AES-256 data key, stored
only wrapped by `DATA_ENCRYPTION_MASTER_KEY`; names, emails, dates of birth, foreign passport
numbers, file names, uploaded files, notifications, wallet descriptions, founders and
beneficial owners are sealed under it. Sign-in finds an email by a keyed hash (blind index).
State-issued identifiers (Aletheia ID, national ID, passport number, references) stay in
clear so they can be looked up. The audit trail names people only by those identifiers.

| Collection | Holds |
|---|---|
| `accounts` | Portal accounts: Aletheia ID, sealed personal details, email blind index, scrypt passphrase hash, status, residency, oath pending, national ID and passport number, identity public key, AEY balance, lockout state |
| `officers` | Console accounts: officer ID, sealed name and email, passphrase hash, TOTP secret, role, disabled |
| `subject_keys` | Each person's data key, wrapped by the master key. Deleting one erases that person |
| `sessions` | SHA-256 of each session token, owner, idle timeout and absolute expiry |
| `passkeys`, `webauthn_challenges` | Registered passkeys (public key and counter) and single-use challenges |
| `applications` | E-residency and citizenship applications (applicant details sealed) and their decisions |
| `citizens` | The citizen registry: national ID, passport number (after the oath), status, sealed name and birth details, SHA-256 of the enrolment record |
| `companies` | Company formations and their review state (founder and beneficial owners sealed) |
| `documents`, `file_chunks` | Issued certificates and submitted documents; files up to 4 MB, encrypted in 150 KB chunks, checked against their SHA-256 on every download |
| `notifications`, `outbox` | Sealed messages to portal users, and email copies waiting to be sent |
| `wallet_transfers`, `wallet_entries` | AEY transfers and Treasury issuances, and each wallet's ledger |
| `border_crossings`, `rescissions` | Border decisions and citizenship rescission proceedings |
| `audit_events` | Every decision, sign-in and failed sign-in, with a SHA-256 of the event, indexed by day |
| `settings`, `counters` | Console settings (officer session timeout) and reference number sequences |

The schema (collections and indexes) is `lib/server/schema.json`.

## How the processes work

- **E-residency:** apply (identity, document upload, Ed25519 key made in the browser) → officer verifies documents and approves → certificate in the vault, residency for three years.
- **Citizenship:** apply → officer approves (national ID reserved, status "Oath Pending") → the person swears the oath of allegiance in the portal by typing their full name → citizenship takes effect, passport number and credential issued.
- **Companies:** e-residents and citizens file → the Registrar approves (charter issued) or requests changes → the founder amends and refiles.
- **AEY:** enters wallets only by **Treasury issuance** (administrators, reason required, audited, listed on the Treasury page with the total issued); afterwards it moves between accounts by transfer.
- **Officers:** administrators create officers (who sign in with their officer ID or email and a temporary password), disable them (signed out at once) and re-enable them. An administrator cannot disable themselves or the last administrator.
- **Erasure:** `npm run erase-person -- ALE-ID-2026-000001 --yes` shreds the person's data key, deletes their sessions and passkeys and suspends the account. Records the State keeps (references, decisions, audit trail) remain without personal data.

## Security

- Personal data: AES-256-GCM per person, keys wrapped by the master key; erasure by key shredding.
- Passkeys (WebAuthn): portal sign-in with a fingerprint, face or device PIN; registered from Keys & Security.
- Passphrases: scrypt (N=2¹⁵, r=8, p=1), at least 12 characters; an unknown ID takes as long to refuse as a wrong passphrase.
- Lockout: portal accounts after 10 failures, officers after 5, for 15 minutes; sign-in is also rate limited per IP.
- Officers: username (officer ID or email) and password. Each officer can switch on a 6-digit authenticator code (TOTP) in Settings; then sign-in asks for it, and a code is accepted once.
- Sessions: random 256-bit token in an HttpOnly, SameSite=Strict cookie (Secure in production); only its hash is stored; 30 minutes idle (officers: configurable in Settings), 12 hours at most. Changing a passphrase signs out every other session.
- Writes must come from the site itself (Origin / Sec-Fetch-Site check).
- Administrators only: console settings, creating officers, executing or dismissing rescissions.
- Identity keys are Ed25519 pairs made in the browser with WebCrypto. Only the public key is sent; the private key is downloaded by the person.
- AEY balances live in AletheiaDB (not on AletheiaChain). Only administrators can issue AEY (Treasury); otherwise balances only move between accounts. A transfer debits and marks the sender in one atomic update, so a transfer interrupted by a crash is finished or marked failed on the next wallet read.

## API

Portal (session cookie `ale_portal_session`):
`POST /api/portal/auth/{register,login,logout}` · `GET|PATCH /api/portal/me` · `POST /api/portal/me/passphrase` ·
`GET /api/portal/dashboard` · `GET|POST /api/portal/applications` · `GET|POST /api/portal/companies`, `PUT /api/portal/companies/{id}` ·
`GET|POST /api/portal/documents`, `GET /api/portal/documents/{id}/file` · `GET|PATCH /api/portal/notifications`, `PATCH /api/portal/notifications/{id}` ·
`GET /api/portal/wallet`, `POST /api/portal/wallet/transfers` · `POST /api/portal/identity/key` · `GET|POST /api/portal/oath` ·
`GET /api/portal/passkeys`, `GET|POST /api/portal/passkeys/register`, `DELETE /api/portal/passkeys/{id}` · `GET|POST /api/portal/auth/passkey`

Console (session cookie `ale_officer_session`):
`POST /api/admin/auth/{login,logout}` · `GET /api/admin/me`, `POST /api/admin/me/passphrase` · `GET /api/admin/dashboard` ·
`GET /api/admin/applications?type=`, `POST /api/admin/applications/{id}/decision` · `GET /api/admin/citizens` ·
`GET /api/admin/companies`, `POST /api/admin/companies/{id}/decision` · `GET /api/admin/documents`, `POST /api/admin/documents/{id}/decision`, `GET /api/admin/documents/{id}/file` ·
`GET|POST /api/admin/rescissions`, `POST /api/admin/rescissions/{id}/decision` · `GET /api/admin/activity?category=` · `GET|POST /api/admin/immigration` ·
`GET|PATCH /api/admin/settings` · `GET|POST /api/admin/officers`, `PATCH /api/admin/officers/{officerId}` · `GET /api/admin/security` · `GET|POST /api/admin/treasury`

`GET /api/admin/activity` returns 100 events and a `next` cursor; pass it as `?before=` for older ones.

Errors are `{"error": "message"}` with the HTTP status (401 not signed in, 403 not allowed, 409 conflict, 503 database unavailable).

## Tests

Both start a throwaway AletheiaDB (`cargo build --release` in `aletheia-db` first, or set `ALETHEIADB_BIN`) and the built site:

```sh
npm run build
npm run test:hosts                                 # the console on its own address
npm run test:api                                   # 130 API checks: every endpoint, access rule, encryption at rest, email, erasure
CHROMIUM_PATH=/path/to/chrome npm run test:ui      # the whole flow in a real browser, including passkeys and the oath
```

## Known limits

- AletheiaDB indexes match exact values only and refuses a query that would examine more than
  50,000 documents. The audit trail is read day by day through its `day` index, so it is safe
  as long as one category on one day stays under that; other lists (applications, companies,
  documents, citizens) are read whole and will need paging when they pass about 50,000 records.
- Decisions write several records one after another (the decision, the registry entry, the
  certificate, the notification). AletheiaDB has no multi-document transactions, so a database
  outage in the middle can leave a decision recorded without, for example, its notification.
  The decision itself is always written first and is never applied twice.
