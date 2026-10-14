// CRUD routes for /api/employees. All data lives in AletheiaDB (database emp_test).
import { Router } from "express";
import { ConflictError, NotFoundError } from "@aletheia/aletheiadb";
import { EmployeeInput, EmployeePatch, GENDERS, toEmployee } from "./employee.model.js";

export function employeesRouter(db) {
  const employees = db.collection("employees");
  const router = Router();

  // Create
  router.post("/", async (req, res) => {
    const input = EmployeeInput.parse(req.body);
    const doc = await employees.insertOne({ ...input, created_at: new Date().toISOString() });
    res.status(201).json({ message: "Employee created", data: toEmployee(doc) });
  });

  // List, newest first. Optional ?gender=female&page=1&limit=10
  router.get("/", async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const filter = {};
    if (req.query.gender) {
      if (!GENDERS.includes(req.query.gender)) return res.status(400).json({ error: `gender must be one of: ${GENDERS.join(", ")}` });
      filter.gender = req.query.gender;
    }
    const [result, total] = await Promise.all([
      employees.find(filter, { sort: { created_at: -1 }, limit, skip: (page - 1) * limit }),
      employees.count(filter),
    ]);
    res.json({ data: result.documents.map(toEmployee), page, limit, total, hasMore: result.hasMore });
  });

  // Read one
  router.get("/:id", async (req, res) => {
    const doc = await employees.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Employee not found" });
    res.json({ data: toEmployee(doc) });
  });

  // Replace every field. Send "version" (from a previous read) to guard against
  // overwriting someone else's change; without it the current version is used.
  router.put("/:id", async (req, res) => {
    const { version, ...body } = req.body ?? {};
    const input = EmployeeInput.parse(body);
    const current = await employees.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Employee not found" });
    const doc = await employees.replaceOne(current._id, version ?? current._rev, { ...input, created_at: current.created_at });
    res.json({ message: "Employee updated", data: toEmployee(doc) });
  });

  // Update some fields
  router.patch("/:id", async (req, res) => {
    const { version, ...body } = req.body ?? {};
    const changes = EmployeePatch.parse(body);
    const current = await employees.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Employee not found" });
    const doc = await employees.updateOne(current._id, version ?? current._rev, { $set: changes });
    res.json({ message: "Employee updated", data: toEmployee(doc) });
  });

  // Delete
  router.delete("/:id", async (req, res) => {
    const current = await employees.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Employee not found" });
    await employees.deleteOne(current._id, current._rev);
    res.json({ message: "Employee deleted", id: current._id });
  });

  return router;
}

/** Maps AletheiaDB conflicts to clear messages for API callers. */
export function conflictMessage(err) {
  if (err instanceof ConflictError) {
    return err.message.includes("unique field 'email'")
      ? "An employee with this email already exists"
      : "This employee was changed by someone else since you read it. Reload and try again.";
  }
  if (err instanceof NotFoundError) return "Not found";
  return null;
}
