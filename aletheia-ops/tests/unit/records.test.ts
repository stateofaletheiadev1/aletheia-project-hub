import { beforeEach, describe, expect, it } from "vitest";
import { DevelopmentGateway } from "@/adapters/publication/development-gateway";
import { MemoryStore } from "@/adapters/memory/memory-store";
import { parseBody, type Content } from "@/domain/content";
import { publicationHash } from "@/lib/content-hash";
import type { Actor, Role } from "@/policy/roles";
import type { PublicationGateway, PublicationOutcome } from "@/ports/publication";
import { ensureAuditHead, verifyChain } from "@/services/audit";
import { Refused } from "@/services/identity/identity";
import { deliver } from "@/services/records/publication";
import { createDraft, getRecord, listRecords, queueFor, saveDraft, step, versionsOf, type Actorish } from "@/services/records/records";
import type { OutboxDoc, RecordDoc } from "@/services/records/types";

let store: MemoryStore;
let clock = new Date("2026-10-15T09:00:00Z");
const uow = () => ({ store, now: () => clock, correlationId: "test" });

function who(id: string, roles: Role[], institution = "treasury", clearance: Actor["grants"][number]["clearance"] = "restricted"): Actorish {
  return { actor: { id, state: "active", mfa: true, grants: roles.map((role) => ({ role, institution, clearance })) }, official: { id } };
}
const author = who("author", ["author"]);
const reviewer = who("reviewer", ["reviewer"]);
const approver = who("approver", ["approving_officer"]);
const approver2 = who("approver2", ["approving_officer"]);
const publisher = who("publisher", ["publishing_officer"], "treasury", "public");
const outsider = who("outsider", ["approving_officer", "author"], "electoral-commission");

const content = (title = "Notice of the first public session of the Treasury"): Content => ({
  title,
  summary: "When and where the Treasury will hold its first public session.",
  body: parseBody("The Treasury will hold its first public session on 1 November 2026.\n\n## Agenda\n\n- Founding budget\n- Questions from the public"),
  facts: [{ label: "Date", value: "1 November 2026" }],
});

async function rec(id: string) {
  return (await store.findOne<RecordDoc>("records", { id }))!;
}

async function go(actorish: Actorish | "system", id: string, action: Parameters<typeof step>[4], reason?: string) {
  return step(uow(), actorish, id, (await rec(id))._rev, action, reason);
}

beforeEach(async () => {
  store = new MemoryStore();
  clock = new Date("2026-10-15T09:00:00Z");
  await ensureAuditHead(store);
});

describe("drafting and submission", () => {
  it("parses the composer's plain text into the portal's blocks", () => {
    expect(parseBody("One.\n\n## Two\n\n- a\n- b\n\n> quoted")).toEqual([
      { type: "paragraph", text: "One." },
      { type: "heading", text: "Two" },
      { type: "list", items: ["a", "b"] },
      { type: "quote", text: "quoted" },
    ]);
  });

  it("an author drafts, edits and submits; submission freezes a hashed version", async () => {
    const id = await createDraft(uow(), author, { register: "dispatches", institution: "treasury", classification: "public", content: { ...content("Draft"), body: [] } });
    await expect(go(author, id, "submit")).rejects.toThrow(/Write the text/);
    await saveDraft(uow(), author, id, (await rec(id))._rev, content(), "public");
    await go(author, id, "submit");
    const r = await rec(id);
    expect(r.state).toBe("submitted");
    expect(r.currentVersion?.number).toBe(1);
    expect(r.currentVersion?.hash).toMatch(/^[0-9a-f]{64}$/);
    // Submitted text cannot be edited.
    await expect(saveDraft(uow(), author, id, r._rev, content("Changed after submission!"), "public")).rejects.toThrow(/cannot be edited/);
  });

  it("a stale save is refused without overwriting (E2E 17)", async () => {
    const id = await createDraft(uow(), author, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    const rev = (await rec(id))._rev;
    await saveDraft(uow(), author, id, rev, content("First edit of the notice"), "public");
    await expect(saveDraft(uow(), author, id, rev, content("Second edit from an old copy"), "public")).rejects.toThrow(/changed while you were working/);
    expect((await rec(id)).draft.title).toBe("First edit of the notice");
  });
});

describe("review, approval and separation of duties", () => {
  async function submitted(register: "dispatches" | "decisions" = "dispatches") {
    const id = await createDraft(uow(), author, { register, institution: "treasury", classification: "public", content: content() });
    await go(author, id, "submit");
    return id;
  }

  it("revision creates a new version and old approvals do not carry over (E2E 5, 6, 21)", async () => {
    const id = await submitted();
    await go(reviewer, id, "take_for_review");
    await go(reviewer, id, "request_revision", "Give the venue.");
    await saveDraft(uow(), author, id, (await rec(id))._rev, { ...content(), facts: [...content().facts, { label: "Venue", value: "Antioch" }] }, "public");
    await go(author, id, "submit");
    const r = await rec(id);
    expect(r.currentVersion?.number).toBe(2);
    expect((await versionsOf(uow(), id)).map((v) => v.number)).toEqual([2, 1]);
    await go(reviewer, id, "take_for_review");
    await go(approver, id, "approve");
    expect((await rec(id)).state).toBe("approved");
  });

  it("the author cannot approve their own submission (E2E 9), nor can anyone outside the institution (E2E 8)", async () => {
    const both = who("author", ["author", "approving_officer"]);
    const id = await createDraft(uow(), both, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    await go(both, id, "submit");
    await go(reviewer, id, "take_for_review");
    await expect(go(both, id, "approve")).rejects.toThrow(/someone else/);
    await expect(go(outsider, id, "approve")).rejects.toThrow(/No such record/);
    await go(approver, id, "approve");
  });

  it("decisions: adoption, then a second officer approves", async () => {
    const id = await submitted("decisions");
    await go(reviewer, id, "take_for_review");
    await go(approver, id, "adopt");
    await expect(go(approver, id, "approve")).rejects.toThrow(/second officer/);
    await go(approver2, id, "approve");
    expect((await rec(id)).state).toBe("approved");
  });

  it("an approved record cannot be published without authorisation (E2E 10)", async () => {
    const id = await submitted();
    await go(reviewer, id, "take_for_review");
    await go(approver, id, "approve");
    await expect(go(publisher, id, "publish")).rejects.toThrow(/not available at the record's current stage/);
  });
});

describe("publication", () => {
  async function approved() {
    const id = await createDraft(uow(), author, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    await go(author, id, "submit");
    await go(reviewer, id, "take_for_review");
    await go(approver, id, "approve");
    return id;
  }

  it("authorisation issues the reference atomically; publication is confirmed only by the gateway (E2E 11)", async () => {
    const a = await approved();
    const b = await approved();
    await go(publisher, a, "authorise_publication");
    await go(publisher, b, "authorise_publication");
    expect((await rec(a)).reference).toBe("AGV-DSP-2026-0001");
    expect((await rec(b)).reference).toBe("AGV-DSP-2026-0002");
    const { outboxId } = await go(publisher, a, "publish");
    expect((await rec(a)).state).toBe("publishing");
    const result = await deliver(uow(), new DevelopmentGateway("https://www.aletheiagov.org"), outboxId!);
    expect(result.state).toBe("confirmed");
    const r = await rec(a);
    expect(r.state).toBe("published");
    expect(r.publication).toMatchObject({ reference: "AGV-DSP-2026-0001", simulated: true, url: "https://www.aletheiagov.org/dispatches/agv-dsp-2026-0001" });
    const entry = (await store.findOne<OutboxDoc>("outbox", { id: outboxId! }))!;
    expect(r.publication?.contentHash).toBe(publicationHash(entry.payload));
    expect((await verifyChain(store)).ok).toBe(true);
  });

  it("a failure is recorded and retried with the same key, without a duplicate (E2E 13, 14)", async () => {
    const id = await approved();
    await go(publisher, id, "authorise_publication");
    const { outboxId } = await go(publisher, id, "publish");
    const calls: string[] = [];
    let answer: PublicationOutcome = { kind: "unknown", reason: "timed out" };
    const flaky: PublicationGateway = {
      simulated: false,
      publish: async (_p, key) => (calls.push(`publish ${key}`), answer),
      lookup: async (key) => (calls.push(`lookup ${key}`), { kind: "absent" as const }),
      withdraw: async () => ({ kind: "unknown", reason: "not used" }),
    };
    expect((await deliver(uow(), flaky, outboxId!)).state).toBe("needs_reconciliation");
    expect((await rec(id)).state).toBe("publishing"); // not assumed failed
    answer = { kind: "rejected", reason: "content hash mismatch" };
    expect((await deliver(uow(), flaky, outboxId!)).state).toBe("failed");
    expect((await rec(id)).state).toBe("publication_failed");
    const key = (await store.findOne<OutboxDoc>("outbox", { id: outboxId! }))!.idempotencyKey;
    expect(calls).toEqual([`publish ${key}`, `lookup ${key}`, `publish ${key}`]);
    // Retry: same outbox entry, same idempotency key.
    const retry = await go(publisher, id, "retry_publication");
    expect(retry.outboxId).toBe(outboxId);
    expect(await store.count("outbox")).toBe(1);
    expect((await deliver(uow(), new DevelopmentGateway("https://www.aletheiagov.org"), outboxId!)).state).toBe("confirmed");
    expect(await store.count("publication_receipts")).toBe(1);
  });

  it("a restricted record is not publishable until reclassified Public", async () => {
    const id = await createDraft(uow(), author, { register: "documents", institution: "treasury", classification: "restricted", content: content() });
    await go(author, id, "submit");
    await go(reviewer, id, "take_for_review");
    await go(approver, id, "approve");
    await expect(go(publisher, id, "authorise_publication")).rejects.toThrow(/No such record|classified restricted/);
  });
});

describe("visibility (E2E 15)", () => {
  it("restricted records are invisible to officials without clearance, in lists, lookups and queues", async () => {
    const id = await createDraft(uow(), author, { register: "finance", institution: "treasury", classification: "restricted", content: content() });
    const low = who("low", ["reviewer"], "treasury", "internal");
    expect(await getRecord(uow(), low.actor, id)).toBeNull();
    expect((await listRecords(uow(), low.actor, { register: "finance" })).total).toBe(0);
    expect(await queueFor(uow(), low.actor)).toEqual([]);
    expect((await listRecords(uow(), reviewer.actor, { register: "finance" })).total).toBe(1);
    expect(await getRecord(uow(), outsider.actor, id)).toBeNull();
  });

  it("the queue lists what the official may do now", async () => {
    const id = await createDraft(uow(), author, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    expect((await queueFor(uow(), author.actor)).map((q) => q.offers.map((o) => o.action))).toEqual([["submit"]]);
    await go(author, id, "submit");
    expect(await queueFor(uow(), author.actor)).toEqual([]);
    expect((await queueFor(uow(), reviewer.actor))[0]?.offers.map((o) => o.action)).toContain("take_for_review");
  });

  it("refusals are explained, and denials of authority are audited", async () => {
    const id = await createDraft(uow(), author, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    await go(author, id, "submit");
    const before = await store.count("audit_events");
    await expect(go(publisher, id, "take_for_review")).rejects.toBeInstanceOf(Refused);
    expect(await store.count("audit_events")).toBe(before + 1);
  });
});

describe("a founder's authority (ADR 0009)", () => {
  it("a founder writes, reviews, approves, authorises and publishes their own record; each override is audited", async () => {
    const founder: Actorish = { actor: { id: "founder", state: "active", mfa: true, grants: [{ role: "founder", institution: "*", clearance: "confidential" }] }, official: { id: "founder" } };
    const id = await createDraft(uow(), founder, { register: "decisions", institution: "founding-government", classification: "public", content: content() });
    await go(founder, id, "submit");
    await go(founder, id, "take_for_review");
    await go(founder, id, "adopt");
    await go(founder, id, "approve");
    await go(founder, id, "authorise_publication");
    const { outboxId } = await go(founder, id, "publish");
    await deliver(uow(), new DevelopmentGateway("https://www.aletheiagov.org"), outboxId!);
    expect((await rec(id)).state).toBe("published");
    const overrides = (await store.find<{ details: { step: string } }>("audit_events", { action: "record.founder_authority" }, { sort: { seq: 1 }, limit: 20 })).documents.map((e) => e.details.step);
    // For decisions, whoever approved may not normally release: that is set aside too.
    expect(overrides).toEqual(["take_for_review", "adopt", "approve", "authorise_publication", "publish"]);
    expect((await verifyChain(store)).ok).toBe(true);
  });

  it("other officials are still bound: an author cannot approve their own version", async () => {
    const both = who("author", ["author", "approving_officer"]);
    const id = await createDraft(uow(), both, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    await go(both, id, "submit");
    await go(reviewer, id, "take_for_review");
    await expect(go(both, id, "approve")).rejects.toThrow(/someone else/);
  });

  it("rules that are not about who acts still apply to founders: only Public records are published", async () => {
    const founder: Actorish = { actor: { id: "founder", state: "active", mfa: true, grants: [{ role: "founder", institution: "*", clearance: "confidential" }] }, official: { id: "founder" } };
    const id = await createDraft(uow(), founder, { register: "documents", institution: "treasury", classification: "internal", content: content() });
    await go(founder, id, "submit");
    await go(founder, id, "take_for_review");
    await go(founder, id, "approve");
    await expect(go(founder, id, "authorise_publication")).rejects.toThrow(/classified internal/);
  });
});

describe("withdrawal from the public record (ADR 0010)", () => {
  // A portal stand-in that confirms everything, not simulated, and records what it was asked.
  const asked: string[] = [];
  const portalLike: PublicationGateway = {
    simulated: false,
    publish: async (p) => (asked.push(`publish ${p.reference}`), { kind: "confirmed", reference: p.reference, url: `https://aletheiagov.org/dispatches/${p.slug}`, publishedAt: "2026-10-16T10:00:00.000Z", contentHash: p.contentHash, simulated: false }),
    withdraw: async (w) => (asked.push(`withdraw ${w.reference}: ${w.reason}`), { kind: "confirmed", reference: w.reference, url: "u", publishedAt: "2026-10-16T11:00:00.000Z", contentHash: "", simulated: false }),
    lookup: async () => ({ kind: "absent" as const }),
  };
  const founder: Actorish = { actor: { id: "founder", state: "active", mfa: true, grants: [{ role: "founder", institution: "*", clearance: "confidential" }] }, official: { id: "founder" } };

  it("a founder withdraws a published or archived record; the portal is asked once; the reason is kept", async () => {
    asked.length = 0;
    const id = await createDraft(uow(), founder, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    for (const a of ["submit", "take_for_review", "approve", "authorise_publication"] as const) await go(founder, id, a);
    const { outboxId } = await go(founder, id, "publish");
    await deliver(uow(), portalLike, outboxId!);
    await go(founder, id, "archive");
    // Archiving does not take it off the public record.
    expect((await rec(id)).publication?.withdrawnAt).toBeUndefined();
    await expect(go(founder, id, "withdraw_publication")).rejects.toThrow(/Give a reason/);
    const w = await go(founder, id, "withdraw_publication", "Published in error during testing.");
    expect((await rec(id)).state).toBe("public_withdrawn");
    expect((await deliver(uow(), portalLike, w.outboxId!)).state).toBe("confirmed");
    expect((await rec(id)).publication).toMatchObject({ withdrawnAt: "2026-10-16T11:00:00.000Z", withdrawalReason: "Published in error during testing." });
    expect(asked).toEqual(["publish AGV-DSP-2026-0001", "withdraw AGV-DSP-2026-0001: Published in error during testing."]);
    // Nothing more can be withdrawn, and a repeat delivery is a no-op.
    expect((await deliver(uow(), portalLike, w.outboxId!)).state).toBe("confirmed");
    expect(asked).toHaveLength(2);
    expect((await verifyChain(store)).ok).toBe(true);
  });

  it("only founders may withdraw; a publishing officer may not", async () => {
    const id = await createDraft(uow(), founder, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    for (const a of ["submit", "take_for_review", "approve", "authorise_publication"] as const) await go(founder, id, a);
    const { outboxId } = await go(founder, id, "publish");
    await deliver(uow(), portalLike, outboxId!);
    await expect(go(publisher, id, "withdraw_publication", "No authority")).rejects.toThrow(/authority/);
  });

  it("a simulated publication is not on the public record and cannot be withdrawn", async () => {
    const id = await createDraft(uow(), founder, { register: "dispatches", institution: "treasury", classification: "public", content: content() });
    for (const a of ["submit", "take_for_review", "approve", "authorise_publication"] as const) await go(founder, id, a);
    const { outboxId } = await go(founder, id, "publish");
    await deliver(uow(), new DevelopmentGateway("https://www.aletheiagov.org"), outboxId!);
    await expect(go(founder, id, "withdraw_publication", "test")).rejects.toThrow(/not on aletheiagov.org/);
  });
});
