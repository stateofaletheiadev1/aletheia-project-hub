import { describe, expect, it } from "vitest";
import { REGISTERS } from "@/domain/registers";
import type { Actor, Grant, Role } from "@/policy/roles";
import { DEFINITIONS } from "@/workflow/definitions";
import { availableActions, decide, dueAt, publicationEligibility } from "@/workflow/engine";
import type { RecordFacts } from "@/workflow/types";

const INST = "treasury";
const HASH = "a".repeat(64);

function official(id: string, ...roles: Role[]): Actor {
  const grants: Grant[] = roles.map((role) => ({ role, institution: INST, clearance: "confidential" }));
  return { id, state: "active", mfa: true, grants };
}

const author = official("author", "author");
const reviewer = official("reviewer", "reviewer");
const approver = official("approver", "approving_officer");
const approver2 = official("approver2", "approving_officer");
const publisher = official("publisher", "publishing_officer");
const verifier = official("verifier", "appointments_verifier");
const finance = official("fin", "finance_officer");
const outsider: Actor = { id: "x", state: "active", mfa: true, grants: [{ role: "approving_officer", institution: "electoral-commission", clearance: "confidential" }] };

function facts(over: Partial<RecordFacts> = {}): RecordFacts {
  return {
    state: "draft",
    institution: INST,
    classification: "public",
    versionAuthors: ["author"],
    authorId: "author",
    approvals: [],
    currentVersionHash: HASH,
    attachmentsUnscanned: 0,
    ...over,
  };
}

const docs = DEFINITIONS.documents;

describe("baseline lifecycle (documents)", () => {
  it("runs from draft to published with distinct officers", () => {
    let f = facts();
    const step = (action: Parameters<typeof decide>[2]["action"], actor: Actor | "system", reason?: string) => {
      const d = decide(docs, f, { action, actor, reason });
      expect(d, `${action} from ${f.state}`).toMatchObject({ ok: true });
      if (d.ok) f = { ...f, state: d.to };
      return d;
    };
    step("submit", author);
    step("take_for_review", reviewer);
    const approve = step("approve", approver);
    expect(approve.ok && approve.effects).toContain("record_approval");
    f = { ...f, approvals: [{ officialId: "approver", versionHash: HASH }] };
    const auth = step("authorise_publication", publisher);
    expect(auth.ok && auth.effects).toContain("issue_reference");
    const pub = step("publish", publisher);
    expect(pub.ok && pub.effects).toContain("enqueue_publication");
    step("confirm_publication", "system");
    expect(f.state).toBe("published");
  });

  it("returns a submission with a reason, and the author resubmits", () => {
    const d = decide(docs, facts({ state: "under_review" }), { action: "request_revision", actor: reviewer, reason: "Section 3 cites the wrong article." });
    expect(d).toMatchObject({ ok: true, to: "revision_requested" });
    expect(decide(docs, facts({ state: "revision_requested" }), { action: "submit", actor: author })).toMatchObject({ ok: true, to: "submitted" });
  });

  it("requires a reason to return, reject or withdraw", () => {
    for (const action of ["request_revision", "reject"] as const) {
      const d = decide(docs, facts({ state: "under_review" }), { action, actor: reviewer });
      expect(d).toMatchObject({ ok: false, code: "guard" });
    }
    expect(decide(docs, facts(), { action: "withdraw", actor: author, reason: " " })).toMatchObject({ ok: false, code: "guard" });
  });

  it("refuses steps from the wrong stage", () => {
    expect(decide(docs, facts({ state: "draft" }), { action: "approve", actor: approver })).toMatchObject({ ok: false, code: "wrong_state" });
    expect(decide(docs, facts({ state: "published" }), { action: "submit", actor: author })).toMatchObject({ ok: false, code: "wrong_state" });
    expect(decide(docs, facts({ state: "approved" }), { action: "publish", actor: publisher })).toMatchObject({ ok: false, code: "wrong_state" });
  });

  it("only the system records the portal's answer", () => {
    expect(decide(docs, facts({ state: "publishing" }), { action: "confirm_publication", actor: publisher })).toMatchObject({ ok: false, code: "forbidden" });
    expect(decide(docs, facts({ state: "publishing" }), { action: "fail_publication", actor: "system" })).toMatchObject({ ok: true, to: "publication_failed" });
    expect(decide(docs, facts({ state: "draft" }), { action: "submit", actor: "system" })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("a failed publication is retried by a publishing officer", () => {
    expect(decide(docs, facts({ state: "publication_failed" }), { action: "retry_publication", actor: publisher })).toMatchObject({ ok: true, to: "publishing" });
  });

  it("a correction of a published record goes back through review", () => {
    expect(decide(docs, facts({ state: "published" }), { action: "start_correction", actor: author, reason: "Typographical error in clause 4." })).toMatchObject({
      ok: true,
      to: "correction_in_progress",
    });
    expect(decide(docs, facts({ state: "correction_in_progress" }), { action: "submit", actor: author })).toMatchObject({ ok: true, to: "submitted" });
    expect(decide(docs, facts({ state: "correction_in_progress" }), { action: "withdraw", actor: author, reason: "abandon" })).toMatchObject({ ok: false });
  });
});

describe("separation of duties", () => {
  it("an author cannot approve their own version, even holding the approver role", () => {
    const both = official("author", "author", "approving_officer");
    const d = decide(docs, facts({ state: "under_review" }), { action: "approve", actor: both });
    expect(d).toMatchObject({ ok: false, code: "guard" });
    expect(!d.ok && d.reasons[0]).toMatch(/someone else/);
  });

  it("anyone who edited the version cannot review or approve it", () => {
    const f = facts({ state: "under_review", versionAuthors: ["author", "approver"] });
    expect(decide(docs, f, { action: "approve", actor: approver })).toMatchObject({ ok: false });
    expect(decide(docs, f, { action: "approve", actor: approver2 })).toMatchObject({ ok: true });
  });

  it("an approver cannot release what they approved where policy separates them (decisions)", () => {
    const both = official("approver", "approving_officer", "publishing_officer");
    const f = facts({ state: "approved", approvals: [{ officialId: "approver", versionHash: HASH }] });
    expect(decide(DEFINITIONS.decisions, f, { action: "authorise_publication", actor: both })).toMatchObject({ ok: false, code: "guard" });
    expect(decide(DEFINITIONS.decisions, f, { action: "authorise_publication", actor: publisher })).toMatchObject({ ok: true });
    // Dispatches allow it.
    expect(decide(DEFINITIONS.dispatches, f, { action: "authorise_publication", actor: both })).toMatchObject({ ok: true });
  });

  it("two distinct approvals when policy requires two", () => {
    const def = { ...docs, requiredApprovals: 2 };
    const first = decide(def, facts({ state: "under_review" }), { action: "approve", actor: approver });
    expect(first).toMatchObject({ ok: true, to: "under_review" });
    const after = facts({ state: "under_review", approvals: [{ officialId: "approver", versionHash: HASH }] });
    expect(decide(def, after, { action: "approve", actor: approver })).toMatchObject({ ok: false, code: "guard" });
    expect(decide(def, after, { action: "approve", actor: approver2 })).toMatchObject({ ok: true, to: "approved" });
  });

  it("approvals bind to the version: an approval of an earlier version does not count", () => {
    const def = { ...docs, requiredApprovals: 2 };
    const stale = facts({ state: "under_review", approvals: [{ officialId: "approver", versionHash: "b".repeat(64) }] });
    expect(decide(def, stale, { action: "approve", actor: approver2 })).toMatchObject({ ok: true, to: "under_review" });
    expect(publicationEligibility(docs, stale)[0]).toMatchObject({ met: false });
  });

  it("decisions: adoption, then approval by a second officer", () => {
    const def = DEFINITIONS.decisions;
    expect(decide(def, facts({ state: "under_review" }), { action: "approve", actor: approver })).toMatchObject({ ok: false, code: "wrong_state" });
    expect(decide(def, facts({ state: "under_review" }), { action: "adopt", actor: approver })).toMatchObject({ ok: true, to: "adopted" });
    const adopted = facts({ state: "adopted", endorsedBy: "approver" });
    expect(decide(def, adopted, { action: "approve", actor: approver })).toMatchObject({ ok: false, code: "guard" });
    expect(decide(def, adopted, { action: "approve", actor: approver2 })).toMatchObject({ ok: true, to: "approved" });
  });

  it("appointments: verified by someone other than the drafter; disclosure authorised before release", () => {
    const def = DEFINITIONS.appointments;
    const drafterVerifier = official("author", "author", "appointments_verifier");
    expect(decide(def, facts({ state: "under_review" }), { action: "verify", actor: drafterVerifier })).toMatchObject({ ok: false });
    expect(decide(def, facts({ state: "under_review" }), { action: "verify", actor: verifier })).toMatchObject({ ok: true, to: "verified" });
    const approved = facts({ state: "approved", approvals: [{ officialId: "approver", versionHash: HASH }] });
    expect(decide(def, approved, { action: "authorise_publication", actor: publisher })).toMatchObject({ ok: false, code: "guard" });
    expect(decide(def, { ...approved, disclosureAuthorised: true }, { action: "authorise_publication", actor: publisher })).toMatchObject({ ok: true });
  });

  it("finance: a source document before submission, a finance officer to approve, public before release", () => {
    const def = DEFINITIONS.finance;
    expect(decide(def, facts({ classification: "restricted" }), { action: "submit", actor: author })).toMatchObject({ ok: false, code: "guard" });
    expect(decide(def, facts({ classification: "restricted", sourceDocument: "AGV-DOC-2026-0001" }), { action: "submit", actor: author })).toMatchObject({ ok: true });
    const review = facts({ state: "under_review", classification: "restricted" });
    expect(decide(def, review, { action: "approve", actor: approver })).toMatchObject({ ok: false, code: "forbidden" });
    expect(decide(def, review, { action: "approve", actor: finance })).toMatchObject({ ok: true, to: "approved" });
    const approved = facts({ state: "approved", classification: "restricted", approvals: [{ officialId: "fin", versionHash: HASH }] });
    expect(decide(def, approved, { action: "authorise_publication", actor: publisher })).toMatchObject({ ok: false });
  });
});

describe("authority", () => {
  it("authority is scoped to the institution", () => {
    expect(decide(docs, facts({ state: "under_review" }), { action: "approve", actor: outsider })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("clearance below the record's classification is no authority", () => {
    const low: Actor = { id: "low", state: "active", mfa: true, grants: [{ role: "approving_officer", institution: INST, clearance: "internal" }] };
    expect(decide(docs, facts({ state: "under_review", classification: "restricted" }), { action: "approve", actor: low })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("suspended officials and officials without MFA have no authority", () => {
    for (const a of [{ ...approver, state: "suspended" as const }, { ...approver, mfa: false }]) {
      expect(decide(docs, facts({ state: "under_review" }), { action: "approve", actor: a })).toMatchObject({ ok: false, code: "forbidden" });
    }
  });

  it("unknown or foreign steps are refused", () => {
    expect(decide(docs, facts(), { action: "adopt", actor: approver })).toMatchObject({ ok: false, code: "unknown_action" });
  });
});

describe("offers", () => {
  it("shows an author only their own steps, and explains a blocked one", () => {
    const offers = availableActions(DEFINITIONS.finance, facts({ classification: "restricted" }), author);
    expect(offers.map((o) => o.action).sort()).toEqual(["submit", "withdraw"]);
    const submit = offers.find((o) => o.action === "submit");
    expect(submit).toMatchObject({ allowed: false });
  });

  it("never offers system steps", () => {
    expect(availableActions(docs, facts({ state: "publishing" }), publisher)).toEqual([]);
  });
});

describe("every register definition", () => {
  it.each(REGISTERS)("%s: every stage in the stepper is reachable and transitions name valid states", (register) => {
    const def = DEFINITIONS[register];
    expect(def.id).toBe(`${register}.v1`);
    const reachable = new Set(["draft"]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of def.transitions) {
        if (t.from.some((s) => reachable.has(s)) && !reachable.has(t.to)) {
          reachable.add(t.to);
          grew = true;
        }
      }
    }
    for (const s of def.stages) expect(reachable.has(s), s).toBe(true);
    expect(def.sod.authorMayNotApprove).toBe(true);
  });

  it("due dates come from policy", () => {
    const entered = new Date("2026-10-15T09:00:00Z");
    expect(dueAt(docs, "submitted", entered)?.toISOString()).toBe("2026-10-18T09:00:00.000Z");
    expect(dueAt(docs, "published", entered)).toBeNull();
  });
});
