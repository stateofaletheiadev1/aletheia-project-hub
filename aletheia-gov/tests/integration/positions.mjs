/**
 * End-to-end check of registrations of interest for all kinds of position, against a real
 * AletheiaDB: a visitor registers for permanent and advisory positions in a browser; a
 * reviewer finds it in the workbench by kind of position; an early registration (made before
 * kinds of position existed) is listed under founding roles.
 *
 *   ALETHEIADB_URL=<any aletheiadb:// URL> DATA_ENCRYPTION_MASTER_KEY=<any key> npm run build && node tests/integration/positions.mjs
 *   (pages are built statically: the form is only rendered when the build sees both settings)
 *   (ALETHEIADB_BIN defaults to ../aletheia-db/target/release/aletheiadb; CHROMIUM_PATH optional)
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { AletheiaDB } from "@aletheia/aletheiadb";

const root = path.resolve(import.meta.dirname, "../..");
const bin = process.env.ALETHEIADB_BIN ?? path.resolve(root, "../aletheia-db/target/release/aletheiadb");
const DB_PORT = 7796;
const PORT = 3296;
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const waitFor = async (url) => {
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${url}`);
};

// A small, valid one-page PDF (the CV check parses it).
function pdf() {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>"];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gov-positions-"));
const rootSecret = randomBytes(24).toString("hex");
const children = [];
const db = spawn(bin, ["serve"], { env: { ...process.env, ALETHEIADB_LISTEN: `127.0.0.1:${DB_PORT}`, ALETHEIADB_DATA_DIR: dataDir, ALETHEIADB_ROOT_KEY_SHA256: createHash("sha256").update(rootSecret).digest("hex"), RUST_LOG: "warn" }, stdio: "inherit" });
children.push(db);
let browser;
try {
  await waitFor(`http://127.0.0.1:${DB_PORT}/health`);
  const auth = { authorization: `Bearer root.${rootSecret}`, "content-type": "application/json" };
  await fetch(`http://127.0.0.1:${DB_PORT}/v1/databases/gov`, { method: "PUT", headers: auth });
  const key = async (role) => {
    const { key: k } = await (await fetch(`http://127.0.0.1:${DB_PORT}/v1/keys`, { method: "POST", headers: auth, body: JSON.stringify({ name: role, database: "gov", role }) })).json();
    return `aletheiadb://${k.replace(".", ":")}@localhost:${DB_PORT}/gov?tls=false`;
  };
  const env = {
    ...process.env,
    APP_ENV: "local",
    APP_BASE_URL: `http://localhost:${PORT}`,
    ALETHEIADB_URL: await key("readWrite"),
    DATA_ENCRYPTION_MASTER_KEY: randomBytes(32).toString("base64"),
    AUTH_SECRET: randomBytes(32).toString("hex"),
  };
  execFileSync(process.execPath, ["scripts/db-bootstrap.mjs"], { cwd: root, env: { ...env, ALETHEIADB_ADMIN_URL: await key("admin") }, stdio: "ignore" });
  execFileSync(process.execPath, ["scripts/admin-bootstrap.mjs", "reviewer@example.org", "Rita Reviewer"], { cwd: root, env: { ...env, BOOTSTRAP_PASSWORD: "temporary-pass-1" }, stdio: "ignore" });

  // An early registration, stored before kinds of position existed (no positionTypes field).
  const raw = AletheiaDB.connect(env.ALETHEIADB_URL).db();
  const now = new Date().toISOString();
  await raw.collection("interest_registrations").insertOne({
    reference: "AGV-EOI-2026-9999", subject: "legacy-subject", institutions: ["any"], expertise: ["Other"],
    pii: { v: 1, iv: "", ct: "", tag: "" }, cvs: [], status: "new", visibility: "confidential", source: "website",
    submittedAt: "2026-01-01T00:00:00.000Z", updatedAt: now, retainUntil: "2099-01-01T00:00:00.000Z",
  });

  const web = spawn(process.execPath, ["scripts/start.mjs", String(PORT)], { cwd: root, env: { ...env, HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "ignore", "inherit"] });
  children.push(web);
  await waitFor(`http://127.0.0.1:${PORT}/api/health`);
  const base = `http://localhost:${PORT}`;

  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();

  console.log("register interest");
  await page.goto(`${base}/register-interest`);
  await page.getByText("Kinds of position you are interested in", { exact: true }).waitFor();
  check("form offers every kind of position", (await page.locator('input[name="positionTypes"]').count()) === 5);
  check("form lists every institution", (await page.locator('input[name="institutions"]').count()) >= 19);
  await page.locator("#interest-fullName").fill("Grace Hopper");
  await page.locator("#interest-email").fill("grace@example.org");
  await page.locator('input[name="positionTypes"][value="permanent"]').check();
  await page.locator('input[name="positionTypes"][value="advisory"]').check();
  await page.locator('input[name="institutions"]').nth(1).check();
  await page.locator("#interest-expertise").selectOption("Engineering and technology");
  await page.locator("#interest-cv").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdf() });
  await page.locator("#interest-consent").check();
  await page.waitForTimeout(3200); // the form refuses submissions faster than 3 s
  await page.locator('form button[type="submit"]').click();
  await page.getByText("Thank you. Your interest is recorded.").waitFor({ timeout: 20000 });
  const confirmation = await page.locator('[role="status"]').innerText();
  check("confirmation names the kinds of position", confirmation.includes("Permanent positions") && confirmation.includes("Advisory, board and expert roles"), confirmation);
  const reference = confirmation.match(/AGV-EOI-\d{4}-\d+/)?.[0];
  check("registration has a reference", Boolean(reference), confirmation);

  console.log("without a kind of position");
  await page.goto(`${base}/register-interest`);
  await page.locator("#interest-fullName").fill("No Kind");
  await page.locator("#interest-email").fill("nokind@example.org");
  await page.locator('input[name="institutions"]').first().check();
  await page.locator("#interest-expertise").selectOption("Other");
  await page.locator("#interest-cv").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdf() });
  await page.locator("#interest-consent").check();
  await page.waitForTimeout(3200);
  await page.locator('form button[type="submit"]').click();
  await page.getByText("Choose at least one kind of position").first().waitFor({ timeout: 20000 });
  check("refused without a kind of position", true);

  console.log("workbench");
  await page.goto(`${base}/sign-in`);
  await page.locator("#signin-email").fill("reviewer@example.org");
  await page.locator("#signin-password").fill("temporary-pass-1");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/workbench\/account/);
  await page.locator('input[name="current"]').fill("temporary-pass-1");
  await page.locator('input[name="next"]').fill("a much longer passphrase 2026");
  await page.locator('input[name="confirm"]').fill("a much longer passphrase 2026");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.waitForTimeout(2000);

  const listed = async (type) => {
    await page.goto(`${base}/workbench/interest${type ? `?type=${type}` : ""}`);
    return page.locator("tbody").innerText();
  };
  let t = await listed("permanent");
  check("filter: permanent shows the new registration", t.includes(reference) && t.includes("Permanent positions"), t);
  t = await listed("advisory");
  check("filter: advisory shows it too", t.includes(reference));
  t = await listed("volunteer");
  check("filter: volunteer shows neither", !t.includes(reference) && !t.includes("AGV-EOI-2026-9999"));
  t = await listed("founding");
  check("filter: founding shows the early registration, not the new one", t.includes("AGV-EOI-2026-9999") && !t.includes(reference), t);
  t = await listed("");
  check("no filter shows both", t.includes(reference) && t.includes("AGV-EOI-2026-9999"));
  await page.goto(`${base}/workbench/interest/${reference}`);
  const detail = await page.locator("main").innerText();
  check("detail page shows kinds of position", /kinds of position/i.test(detail) && detail.includes("Advisory, board and expert roles"), detail.slice(0, 400));

  console.log("opportunities");
  await page.goto(`${base}/opportunities`);
  const opp = await page.locator("main").innerText();
  check("register is for all positions", opp.includes("Opportunities") && opp.includes("Permanent positions") && !opp.includes("No founding roles are open"), opp.slice(0, 300));
} catch (e) {
  check("flow completed", false, String(e).split("\n").slice(0, 4).join(" "));
} finally {
  await browser?.close();
  for (const c of children) c.kill("SIGTERM");
  fs.rmSync(dataDir, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
