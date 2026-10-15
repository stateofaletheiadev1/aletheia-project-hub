import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AletheiaDB, ConflictError, ForbiddenError, InvalidError, NotFoundError, UnauthorizedError, UnavailableError, parseConnectionString } from "../src/index";

describe("aletheiadb:// connection strings", () => {
  it("parses credentials, host and database, TLS by default", () => {
    const o = parseConnectionString("aletheiadb://k1:s3cr%2Ft@db.stateofaletheia.org/gov");
    expect(o).toEqual({ baseUrl: "https://db.stateofaletheia.org", keyId: "k1", secret: "s3cr/t", database: "gov", timeoutMs: 10_000 });
  });

  it("supports ports, timeouts and plain HTTP on loopback only", () => {
    expect(parseConnectionString("aletheiadb://k:s@db.example.org:8443/x?timeoutMs=500").baseUrl).toBe("https://db.example.org:8443");
    expect(parseConnectionString("aletheiadb://k:s@127.0.0.1/x?tls=false").baseUrl).toBe("http://127.0.0.1:7790");
    expect(() => parseConnectionString("aletheiadb://k:s@db.example.org/x?tls=false")).toThrow(InvalidError);
  });

  it("rejects malformed strings", () => {
    expect(() => parseConnectionString("mongodb://k:s@h/x")).toThrow(/aletheiadb:\/\//);
    expect(() => parseConnectionString("aletheiadb://db.example.org/x")).toThrow(/credentials/);
    expect(() => parseConnectionString("aletheiadb://k:s@h/x?timeoutMs=5")).toThrow(/timeoutMs/);
  });
});

describe("transport behaviour (mocked)", () => {
  it("retries unavailable responses and keeps the same idempotency key", async () => {
    const keys: string[] = [];
    let calls = 0;
    const fake = (async (_url: string, init: RequestInit) => {
      calls++;
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]!);
      if (calls < 3) return new Response('{"error":{"code":"Unavailable","message":"busy"}}', { status: 503 });
      return new Response('{"document":{"_id":"a","_rev":1}}', { status: 201 });
    }) as typeof fetch;
    const db = AletheiaDB.connect("aletheiadb://k:s@db.example.org/gov", { fetch: fake });
    const doc = await db.collection("x").insertOne({ a: 1 });
    expect(doc._id).toBe("a");
    expect(calls).toBe(3);
    expect(new Set(keys).size).toBe(1);
  });

  it("does not retry client errors, and maps codes to error classes", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response('{"error":{"code":"Forbidden","message":"no"},"requestId":"r1"}', { status: 403 });
    }) as typeof fetch;
    const db = AletheiaDB.connect("aletheiadb://k:s@db.example.org/gov", { fetch: fake });
    const err = await db.collection("x").count().catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.requestId).toBe("r1");
    expect(calls).toBe(1);
  });

  it("reports network failures as Unavailable", async () => {
    const fake = (async () => {
      throw new TypeError("connect ECONNREFUSED");
    }) as typeof fetch;
    const db = AletheiaDB.connect("aletheiadb://k:s@db.example.org/gov", { fetch: fake, retries: 0 });
    await expect(db.collection("x").count()).rejects.toBeInstanceOf(UnavailableError);
  });
});

// Against a real server binary, when one has been built (cargo build in aletheia-db).
const binary = ["../../../target/debug/aletheiadb.exe", "../../../target/debug/aletheiadb"].map((p) => path.resolve(__dirname, p)).find(existsSync);
const ROOT_SECRET = "sdk-test-root-secret-0123456789abcdef";
const PORT = 17_790 + Math.floor(Math.random() * 1000);

describe.skipIf(!binary)("against a real AletheiaDB server", () => {
  let server: ChildProcess;
  let dir: string;
  const root = () => AletheiaDB.connect(`aletheiadb://root:${ROOT_SECRET}@127.0.0.1:${PORT}/gov?tls=false`);

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "aletheiadb-sdk-"));
    server = spawn(binary!, ["serve"], {
      env: {
        ...process.env,
        ALETHEIADB_LISTEN: `127.0.0.1:${PORT}`,
        ALETHEIADB_DATA_DIR: dir,
        ALETHEIADB_ROOT_KEY_SHA256: createHash("sha256").update(ROOT_SECRET).digest("hex"),
        ALETHEIADB_CACHE_MB: "16",
        RUST_LOG: "warn",
      },
      stdio: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      try {
        await root().health();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("server did not start");
  });

  afterAll(() => {
    server?.kill();
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the full form-to-record flow", async () => {
    const admin = root();
    await admin.db().create();
    await admin.db().ensureCollection("interest");
    await admin.collection("interest").createIndex("email", { unique: true });

    // An application key, as the gov site backend would hold it.
    const res = await fetch(`http://127.0.0.1:${PORT}/v1/keys`, {
      method: "POST",
      headers: { Authorization: `Bearer root.${ROOT_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "gov-site", database: "gov", role: "readWrite" }),
    });
    const { key } = (await res.json()) as { key: string };
    const [id, secret] = key.split(".");
    const app = AletheiaDB.connect(`aletheiadb://${id}:${secret}@127.0.0.1:${PORT}/gov?tls=false`);
    const interest = app.collection<{ email: string; institution: string; note?: string }>("interest");

    const saved = await interest.insertOne({ email: "ada@example.org", institution: "monetary-authority" }, { idempotencyKey: "form-1" });
    const again = await interest.insertOne({ email: "ada@example.org", institution: "monetary-authority" }, { idempotencyKey: "form-1" });
    expect(again._id).toBe(saved._id);
    await expect(interest.insertOne({ email: "ada@example.org", institution: "treasury" })).rejects.toBeInstanceOf(ConflictError);

    const found = await interest.findOne({ email: "ada@example.org" });
    expect(found?.institution).toBe("monetary-authority");
    const updated = await interest.updateOne(saved._id, saved._rev, { $set: { note: "follow up" } });
    expect(updated._rev).toBe(2);
    await expect(interest.updateOne(saved._id, 1, { $set: { note: "stale" } })).rejects.toBeInstanceOf(ConflictError);
    expect(await interest.count({ institution: { $in: ["monetary-authority", "treasury"] } })).toBe(1);
    expect(await interest.findById("does-not-exist")).toBeNull();
    await expect(app.collection("missing").count()).rejects.toBeInstanceOf(NotFoundError);
    await expect(app.db("gov").create()).rejects.toBeInstanceOf(ForbiddenError);

    await interest.deleteOne(updated._id, updated._rev);
    expect(await interest.count()).toBe(0);
    expect(await app.whoami()).toMatchObject({ role: "readWrite", database: "gov" });
  });

  it("commits several writes atomically and keeps append-only collections unchanged", async () => {
    const admin = root();
    await admin.db().create();
    await admin.db().ensureCollection("records");
    await admin.db().ensureCollection("events", { appendOnly: true });
    const records = admin.collection<{ state: string }>("records");
    const rec = await records.insertOne({ state: "draft" });

    const results = await admin.db().commit([
      { op: "update", collection: "records", id: rec._id, expectedRev: 1, update: { $set: { state: "submitted" } } },
      { op: "insert", collection: "events", document: { record: rec._id, to: "submitted" } },
    ]);
    expect(results).toHaveLength(2);

    await expect(
      admin.db().commit([
        { op: "insert", collection: "events", document: { record: rec._id, to: "approved" } },
        { op: "update", collection: "records", id: rec._id, expectedRev: 1, update: { $set: { state: "approved" } } },
      ]),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await admin.collection("events").count()).toBe(1);

    const event = (await admin.collection("events").findOne())!;
    await expect(admin.collection("events").deleteOne(event._id, event._rev)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses wrong keys", async () => {
    const bad = AletheiaDB.connect(`aletheiadb://root:wrong-secret-0123456789abcdef@127.0.0.1:${PORT}/gov?tls=false`);
    await expect(bad.whoami()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
