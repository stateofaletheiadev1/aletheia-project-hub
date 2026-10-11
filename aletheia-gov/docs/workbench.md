# Officers' workbench

The signed-in area where founding-government officers read registrations of interest, open
CVs and manage accounts. Design and security: [ADR 0005](decisions/0005-workbench-sign-in.md),
[ADR 0006](decisions/0006-registrations-of-interest-and-cvs.md).

**Passwords are never written in this repository.** Temporary passwords are shared privately and
changed at first sign-in. A local, git-ignored `ACCOUNTS.local.md` may hold them on the owner's
machine.

## Signing in

1. Go to `/sign-in` (the "Sign in" link in the site header).
2. Enter your email and password.
3. First time: you are taken to **Account and security**. Enter the temporary password as the
   current one and choose your own (at least 12 characters, not containing your email name;
   the rules tick green as you type). You then land on **My office**.

## Accounts

| Email | Name | Roles | Database |
|---|---|---|---|
| emz@kortana.network | Emeka Iwuagwu | Administrator, Reviewer | live (`gov`) |
| emeka@stateofaletheia.org | Emeka | Administrator, Reviewer | live (`gov`) |
| su@stateofaletheia.org | Su | Administrator, Reviewer | live (`gov`) |

Created on 2026-10-10 with `scripts/admin-bootstrap.mjs`, each with a temporary password that
must be changed at first sign-in. Further accounts are added by an administrator under **Users**.

## The menu

| Item | Who sees it | What it does |
|---|---|---|
| My office | Everyone | Counts, a to-do list worked out from the database, latest registrations, recent activity |
| Registrations of interest | Reviewers | Filter by institution and status; open a registration to read it, *Preview CV*, *Download PDF*, set New / Contacted / Archived |
| Users | Administrators | Add accounts, change roles, set a temporary password, disable |
| Audit log | Auditors, administrators | Every sign-in, view, preview, download and change |
| Account and security | Everyone | Change password, sign out everywhere |

## Live only

There is no practice or demonstration mode. The site, locally and on Vercel, uses the live
database `gov`, and shows only real records: anything marked as test data is never displayed.
