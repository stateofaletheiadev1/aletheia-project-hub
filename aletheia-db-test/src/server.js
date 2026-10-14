// aletheia-db-test: an employee management backend whose only storage is AletheiaDB.
//   Browser / client  →  this Express API  →  aletheiadb://…@db.stateofaletheia.org/emp_test
import express from "express";
import { z } from "zod";
import { AletheiaDB, AletheiaDBError, ConflictError } from "@aletheia/aletheiadb";
import { conflictMessage, employeesRouter } from "./employees.routes.js";

if (!process.env.ALETHEIADB_URL) {
  console.error("ALETHEIADB_URL is not set. Copy .env.example to .env and add a key.");
  process.exit(1);
}

const db = AletheiaDB.connect(process.env.ALETHEIADB_URL);
const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => res.json({ service: "aletheia-db-test", resource: "/api/employees" }));

app.get("/health", async (_req, res) => {
  try {
    const who = await db.whoami();
    res.json({ status: "ok", database: who.database, role: who.role });
  } catch (err) {
    res.status(503).json({ status: "unavailable", error: err.message });
  }
});

app.use("/api/employees", employeesRouter(db));

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// One place turns every failure into a clear JSON answer.
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message })) });
  }
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON" });
  const message = conflictMessage(err);
  if (message) return res.status(err instanceof ConflictError ? 409 : 404).json({ error: message });
  if (err instanceof AletheiaDBError) {
    console.error(`AletheiaDB ${err.code}: ${err.message} (request ${err.requestId ?? "-"})`);
    return res.status(err.code === "Invalid" ? 400 : 502).json({ error: "Database error", code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`aletheia-db-test listening on http://localhost:${port}  (storage: ${db.options.baseUrl}, database ${db.options.database})`));
