# aletheia-db-test

A small Employee Management backend (Node.js + Express) whose only storage is **AletheiaDB**,
used to try the database end to end.

```
client  →  this API (localhost:4000)  →  aletheiadb://…@db.stateofaletheia.org/emp_test
```

## Run

```sh
cp .env.example .env     # add a readWrite key for the emp_test database
npm install
npm start                # http://localhost:4000
node demo.mjs            # walks through every operation and prints the responses
```

## Employee model

| Field | Rule |
|---|---|
| fullname | 2–100 characters |
| address | 5–200 characters |
| email | valid email, unique (enforced by AletheiaDB's unique index) |
| telephone | 7–20 digits, optional leading `+` |
| gender | `male`, `female` or `other` |
| salary | number, 0 or more |
| created_at | set by the server on create, never changed |

Responses also include `id`, `updated_at` and `version` (AletheiaDB's revision).

## Endpoints

| Method | Path | Does |
|---|---|---|
| POST | `/api/employees` | Create (201) |
| GET | `/api/employees?gender=&page=&limit=` | List, newest first |
| GET | `/api/employees/:id` | Read one |
| PATCH | `/api/employees/:id` | Update some fields |
| PUT | `/api/employees/:id` | Replace all fields |
| DELETE | `/api/employees/:id` | Delete |
| GET | `/health` | Checks the database connection |

Send `"version"` on PATCH/PUT to refuse the update if someone else changed the employee since
you read it (409). Errors: 400 validation (with per-field messages), 404 not found,
409 duplicate email or stale version, 502 database problem.
