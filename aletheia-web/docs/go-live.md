# Go live: Citizen Portal and Officer Console

How `aletheia-web` (stateofaletheia.org) goes live against the live AletheiaDB.
Same rules as `aletheia-gov/docs/go-live.md`: **secrets go straight into git-ignored files or
into the hosting provider, and are never printed, committed or pasted into a chat.**

Work from the repository root, on an up-to-date `main` (`git pull`).

## 1. Create the database and two keys (on the database server)

SSH to the **kortana-web** server (see `aletheia-db/docs/OPERATIONS.md`) and run:

```sh
K=$(sudo cat /root/aletheiadb-root.key)
curl -s -X PUT  -H "Authorization: Bearer $K" https://db.stateofaletheia.org/v1/databases/web
curl -s -X POST -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  https://db.stateofaletheia.org/v1/keys -d '{"name":"web-bootstrap","database":"web","role":"admin"}'
curl -s -X POST -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  https://db.stateofaletheia.org/v1/keys -d '{"name":"web-site (production)","database":"web","role":"readWrite"}'
unset K
```

Each key reply shows `"key": "<id>.<secret>"` once. A key becomes a connection string by
putting a `:` in place of the first `.`:
`aletheiadb://<id>:<secret>@db.stateofaletheia.org/web`

## 2. Write the two secret files (on your own computer)

`aletheia-web/.env.bootstrap.local` (git-ignored; deleted in step 4):

```
ALETHEIADB_ADMIN_URL=aletheiadb://<web-bootstrap id>:<secret>@db.stateofaletheia.org/web
```

`aletheia-web/.env.production.local` (git-ignored):

```
ALETHEIADB_URL=aletheiadb://<web-site id>:<secret>@db.stateofaletheia.org/web
DATA_ENCRYPTION_MASTER_KEY=<output of: openssl rand -base64 32>
PUBLIC_SITE_URL=https://stateofaletheia.org
```

**Back up `DATA_ENCRYPTION_MASTER_KEY` now** (password manager, plus a sealed offline copy).
If it is lost, no personal data in the portal can ever be read again. Never change it once
people have registered.

Check both files are ignored: `git check-ignore aletheia-web/.env.bootstrap.local aletheia-web/.env.production.local`
must print both paths.

## 3. Create the collections

```sh
cd aletheia-web
npm ci
node --env-file=.env.bootstrap.local scripts/db/bootstrap.mjs
```

It lists every collection and index as `created` (or `exists` when run again).

## 4. Revoke the bootstrap key

Delete `.env.bootstrap.local`. On the database server, revoke the `web-bootstrap` key:

```sh
K=$(sudo cat /root/aletheiadb-root.key)
curl -s -H "Authorization: Bearer $K" https://db.stateofaletheia.org/v1/keys          # find its id
curl -s -X DELETE -H "Authorization: Bearer $K" https://db.stateofaletheia.org/v1/keys/<id>
unset K
```

(Create a new admin key the same way whenever the schema grows and `bootstrap.mjs` must run again.)

## 5. Create the first administrator

```sh
BOOTSTRAP_PASSPHRASE='<a temporary password, 12+ characters>' \
  node --env-file=.env.production.local scripts/db/officer-bootstrap.mjs <your email> "<Your Full Name>"
```

It prints your officer ID (`SEC-OFFICER-0001`). Sign in at `/admin/login` with that ID (or your
email) as the username and the password you chose. Change the password in Settings. An
authenticator code (6-digit, from a phone app) is optional and can be switched on in Settings.

## 6. Put the secrets into the hosting provider and deploy

For Vercel (project for `aletheia-web`, root directory `aletheia-web`):

```sh
npx vercel@60.1.1 link
npx vercel@60.1.1 env add ALETHEIADB_URL production
npx vercel@60.1.1 env add DATA_ENCRYPTION_MASTER_KEY production
npx vercel@60.1.1 env add PUBLIC_SITE_URL production
npx vercel@60.1.1 deploy --prod
```

`env add` asks for the value: paste it from `.env.production.local` at the prompt.
Email is optional and can be added later the same way (`SMTP_URL`, `MAIL_FROM`); until then
emails wait in the outbox and are sent once `SMTP_URL` is set.

## 6b. The officer console's own address

On stateofaletheia.org the console lives at `https://adss.oiss.stateofaletheia.org` by itself:
"Officer Portal" and every `/admin` address on the main site move there, and the console's
address serves only the console. Nothing to set in the code or the environment; the address
only has to exist:

1. **DNS** (where `stateofaletheia.org` is managed): add a record
   type `CNAME`, name `adss.oiss`, value `cname.vercel-dns.com` (or the value Vercel shows in step 2).
2. **Vercel**, project for `aletheia-web` → Settings → Domains → add `adss.oiss.stateofaletheia.org`
   and wait for "Valid Configuration".
3. Deploy the latest `main`.

(`ADMIN_HOST` can override the console's address; `ADMIN_HOST=off` keeps the console at `/admin` on the main site.)

## 7. Check

1. `https://stateofaletheia.org/admin/login`: sign in with your officer ID (or email) and the
   temporary password. Settings: change the password.
2. `https://stateofaletheia.org/portal/login`: Create account, then check it appears and you
   can sign out and in again.
3. In the console, Live Activity Feed shows both sign-ins.

If either page says "not open yet", a variable from step 6 is missing in production.
