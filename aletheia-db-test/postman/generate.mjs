// Builds the Postman collection from a live run: every request is executed against the
// running server (npm start) and its real response is saved as the request's example.
// Usage: node postman/generate.mjs   ->  postman/EmpManagement.postman_collection.json
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4000";
const vars = { employeeId: "", secondEmployeeId: "" };

const ada = { fullname: "Ada Okafor", address: "12 Harbour Road, Lagos", email: "ada.okafor@example.org", telephone: "+234 803 555 0101", gender: "female", salary: 450000 };
const marko = { fullname: "Marko Petrović", address: "Knez Mihailova 5, Belgrade", email: "marko.petrovic@example.org", telephone: "+381 11 555 0199", gender: "male", salary: 380000 };

const steps = [
  { name: "0. Health check", method: "GET", path: "/health", status: 200, about: "Confirms the API is up and connected to AletheiaDB." },
  { name: "1. Create employee (Ada)", method: "POST", path: "/api/employees", body: ada, status: 201, save: ["employeeId", "data.id"], about: "Creates an employee. Saves the new id into {{employeeId}} for the next requests." },
  { name: "2. Create employee (Marko)", method: "POST", path: "/api/employees", body: marko, status: 201, save: ["secondEmployeeId", "data.id"], about: "A second employee, to see lists and filters." },
  { name: "3. Create with invalid data → 400", method: "POST", path: "/api/employees", body: { fullname: "A", address: "x", email: "not-an-email", telephone: "12", gender: "unknown", salary: -5 }, status: 400, about: "Every invalid field is reported with its own message." },
  { name: "4. Create with duplicate email → 409", method: "POST", path: "/api/employees", body: { ...ada, fullname: "Ada Duplicate" }, status: 409, about: "Refused by AletheiaDB's unique index on email." },
  { name: "5. List employees", method: "GET", path: "/api/employees", status: 200, about: "Newest first. Optional query: page, limit (max 100), gender." },
  { name: "6. List employees by gender", method: "GET", path: "/api/employees?gender=female", status: 200, about: "Filter by gender: male, female or other." },
  { name: "7. Get one employee", method: "GET", path: "/api/employees/{{employeeId}}", status: 200, about: "Reads one employee by id." },
  { name: "8. Update some fields (PATCH)", method: "PATCH", path: "/api/employees/{{employeeId}}", body: { salary: 500000, address: "14 Harbour Road, Lagos" }, status: 200, about: "Changes only the fields you send. version goes up by 1." },
  { name: "9. Replace employee (PUT)", method: "PUT", path: "/api/employees/{{employeeId}}", body: { ...ada, fullname: "Ada N. Okafor", address: "14 Harbour Road, Lagos", salary: 520000 }, status: 200, about: "Replaces all fields. created_at is kept." },
  { name: "10. Update with stale version → 409", method: "PATCH", path: "/api/employees/{{employeeId}}", body: { version: 1, salary: 1 }, status: 409, about: "Sending an old version is refused: no silent overwrite of someone else's change." },
  { name: "11. Delete employee", method: "DELETE", path: "/api/employees/{{employeeId}}", status: 200, about: "Deletes the employee." },
  { name: "12. Get deleted employee → 404", method: "GET", path: "/api/employees/{{employeeId}}", status: 404, about: "The employee no longer exists." },
  { name: "13. Delete second employee (clean up)", method: "DELETE", path: "/api/employees/{{secondEmployeeId}}", status: 200, about: "Leaves the collection empty, so the whole collection can be run again." },
];

const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const STATUS_TEXT = { 200: "OK", 201: "Created", 400: "Bad Request", 404: "Not Found", 409: "Conflict" };

function postmanRequest(step) {
  const [pathPart, query] = step.path.split("?");
  const url = {
    raw: `{{baseUrl}}${step.path}`,
    host: ["{{baseUrl}}"],
    path: pathPart.split("/").filter(Boolean),
    ...(query ? { query: query.split("&").map((kv) => ({ key: kv.split("=")[0], value: kv.split("=")[1] })) } : {}),
  };
  return {
    method: step.method,
    header: step.body ? [{ key: "Content-Type", value: "application/json" }] : [],
    ...(step.body ? { body: { mode: "raw", raw: JSON.stringify(step.body, null, 2), options: { raw: { language: "json" } } } } : {}),
    url,
    description: step.about,
  };
}

// Reset so the examples start from an empty collection.
const existing = await (await fetch(`${BASE}/api/employees?limit=100`)).json();
for (const e of existing.data) await fetch(`${BASE}/api/employees/${e.id}`, { method: "DELETE" });

const items = [];
for (const step of steps) {
  const res = await fetch(BASE + fill(step.path), { method: step.method, headers: { "Content-Type": "application/json" }, body: step.body && JSON.stringify(step.body) });
  const json = await res.json();
  if (res.status !== step.status) throw new Error(`${step.name}: expected ${step.status}, got ${res.status} ${JSON.stringify(json)}`);
  if (step.save) vars[step.save[0]] = step.save[1].split(".").reduce((o, k) => o[k], json);
  console.log(`✓ ${step.name}  [${res.status}]`);

  const tests = [`pm.test("status is ${step.status}", () => pm.response.to.have.status(${step.status}));`];
  if (step.save) tests.push(`pm.collectionVariables.set("${step.save[0]}", pm.response.json().${step.save[1]});`);
  items.push({
    name: step.name,
    event: [{ listen: "test", script: { type: "text/javascript", exec: tests } }],
    request: postmanRequest(step),
    response: [
      {
        name: `${res.status} ${STATUS_TEXT[res.status] ?? ""}`.trim(),
        originalRequest: postmanRequest(step),
        status: STATUS_TEXT[res.status] ?? "",
        code: res.status,
        _postman_previewlanguage: "json",
        header: [{ key: "Content-Type", value: "application/json; charset=utf-8" }],
        body: JSON.stringify(json, null, 2),
      },
    ],
  });
}

const collection = {
  info: {
    name: "AletheiaDB · Employee Management (aletheia-db-test)",
    description: "CRUD demo backed by AletheiaDB. Start the API with `npm start`, then use Run collection to execute all requests in order. Each request has a saved example response from a real run.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "employeeId", value: "" },
    { key: "secondEmployeeId", value: "" },
  ],
  item: items,
};
writeFileSync(new URL("./EmpManagement.postman_collection.json", import.meta.url), JSON.stringify(collection, null, 2) + "\n");
console.log("wrote postman/EmpManagement.postman_collection.json");
