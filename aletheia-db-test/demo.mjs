// Walks through every CRUD operation against a running server (npm start), printing
// each request and the exact response. Starts by clearing the demo collection.
const B = process.env.BASE ?? "http://localhost:4000/api/employees";

async function call(title, method, path = "", body) {
  console.log(`\n### ${title}\n$ ${method} /api/employees${path}${body ? "  " + JSON.stringify(body) : ""}`);
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const json = await res.json();
  console.log(`[HTTP ${res.status}]`);
  console.log(JSON.stringify(json, null, 2));
  return json;
}

// Reset: remove whatever earlier runs left behind.
const existing = await (await fetch(`${B}?limit=100`)).json();
for (const e of existing.data) await fetch(`${B}/${e.id}`, { method: "DELETE" });
console.log(`(reset: removed ${existing.data.length} earlier demo employee(s))`);

const ada = await call("1. CREATE an employee", "POST", "", { fullname: "Ada Okafor", address: "12 Harbour Road, Lagos", email: "ada.okafor@example.org", telephone: "+234 803 555 0101", gender: "female", salary: 450000 });
const id = ada.data.id;
await call("2. CREATE a second employee", "POST", "", { fullname: "Marko Petrović", address: "Knez Mihailova 5, Belgrade", email: "marko.petrovic@example.org", telephone: "+381 11 555 0199", gender: "male", salary: 380000 });
await call("3. CREATE with bad data (rejected by validation)", "POST", "", { fullname: "A", address: "x", email: "not-an-email", telephone: "12", gender: "unknown", salary: -5 });
await call("4. CREATE with an email that already exists (rejected by AletheiaDB's unique index)", "POST", "", { fullname: "Ada Duplicate", address: "1 Copy Street, Lagos", email: "ada.okafor@example.org", telephone: "+234 803 555 0102", gender: "female", salary: 1 });
await call("5. LIST all employees (newest first)", "GET");
await call("6. LIST filtered by gender", "GET", "?gender=female");
await call("7. READ one employee", "GET", `/${id}`);
await call("8. UPDATE some fields (PATCH salary and address)", "PATCH", `/${id}`, { salary: 500000, address: "14 Harbour Road, Lagos" });
await call("9. REPLACE the whole record (PUT)", "PUT", `/${id}`, { fullname: "Ada N. Okafor", address: "14 Harbour Road, Lagos", email: "ada.okafor@example.org", telephone: "+234 803 555 0101", gender: "female", salary: 520000 });
await call("10. UPDATE with an out-of-date version (someone else changed it first)", "PATCH", `/${id}`, { version: 1, salary: 1 });
await call("11. DELETE the employee", "DELETE", `/${id}`);
await call("12. READ the deleted employee", "GET", `/${id}`);
await call("13. LIST again", "GET");
