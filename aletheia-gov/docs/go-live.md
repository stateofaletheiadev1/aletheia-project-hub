# Going live

How the site moves from the practice database on a laptop to the live database on Vercel.
Secrets are created straight into files or Vercel and are never printed, committed or pasted
into chat.

## 1. A database key for `gov` (on the database server)

```sh
ssh -i <kortana-web key> ubuntu@155.248.219.32
K=$(sudo cat /root/aletheiadb-root.key)
curl -s -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -X POST https://db.stateofaletheia.org/v1/keys \
  -d '{"name":"gov-site (Vercel production)","database":"gov","role":"readWrite"}'
unset K
```

The reply shows the key once. Keep it only in step 2's file and in Vercel.

## 2. Production settings (on the owner's machine)

Create `aletheia-gov/.env.production.local` (git-ignored):

```
APP_ENV=production
APP_BASE_URL=https://<the live address>
ALETHEIADB_URL=aletheiadb://<key id>:<secret>@db.stateofaletheia.org/gov
DATA_ENCRYPTION_MASTER_KEY=<new: openssl rand -base64 32>
AUTH_SECRET=<new: openssl rand -base64 48>
CRON_SECRET=<new: openssl rand -base64 48>
```

Every secret is new: nothing is reused from the practice database. Keep an offline copy of
`DATA_ENCRYPTION_MASTER_KEY`; without it, live registrations cannot be read.

## 3. Prepare the live database

```sh
node --env-file=.env.production.local scripts/db-bootstrap.mjs
BOOTSTRAP_PASSWORD='<temporary>' node --env-file=.env.production.local scripts/admin-bootstrap.mjs \
  emz@kortana.network "Emeka Iwuagwu" emeka@stateofaletheia.org "Emeka" su@stateofaletheia.org "Su"
```

## 4. Vercel

```sh
npx vercel@60.1.1 link                      # project "aletheia-gov", root = this folder
# for each line of .env.production.local:
npx vercel@60.1.1 env add <NAME> production < value
npx vercel@60.1.1 deploy --prod
```

Then check: the home page, `/register-interest` (form open, no practice badge), sign in at
`/sign-in`, and `/api/health`.

## 5. The domain

When `aletheiagov.org` is registered: add it to the Vercel project, set the DNS records Vercel
shows at the registrar, and change `APP_BASE_URL`.

## Known limits on Vercel

- Rate limits are counted per instance (ADR 0004); account lockout is in the database.
- Two-factor sign-in is not there yet (ADR 0005).
- The daily clean-up runs from `vercel.json` (`/api/jobs/purge-interest`).
