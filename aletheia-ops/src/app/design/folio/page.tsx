import { specimenActor, specimenBody, specimenRows } from "@fixtures/specimens";
import { AttachmentRow, CommentThread, Countersignature, Stepper, type Stage } from "@/components/patterns/custody";
import { CustodySection, Eligibility, Folio } from "@/components/patterns/Folio";
import { NextAction, type StepOffer } from "@/components/patterns/NextAction";
import { REGISTER } from "@/domain/registers";
import { DEFINITIONS } from "@/workflow/definitions";
import { availableActions, publicationEligibility } from "@/workflow/engine";
import { ACTION_LABEL, type RecordFacts } from "@/workflow/types";

// Folio archetype. The offers and eligibility are computed by the real engine from the
// specimen facts; only the people and text are fictional.

const HASH = "9f2c4e1a7b3d5c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6";

export default function FolioSpecimen() {
  const row = specimenRows[0]!;
  const def = DEFINITIONS.decisions;
  const facts: RecordFacts = {
    state: "adopted",
    institution: "council-of-the-states",
    classification: "public",
    versionAuthors: ["tobias"],
    authorId: "tobias",
    approvals: [],
    currentVersionHash: HASH,
    endorsedBy: "marie",
    attachmentsUnscanned: 1,
  };
  const noun = REGISTER.decisions.noun;
  const offers: StepOffer[] = availableActions(def, facts, specimenActor).map((o) => ({
    action: o.action,
    label: ACTION_LABEL[o.action].replace("{noun}", noun),
    allowed: o.allowed,
    reasons: o.allowed ? undefined : o.reasons,
    primary: o.action === "approve",
    danger: o.action === "reject" || o.action === "withdraw",
    consequence:
      o.action === "approve"
        ? "Your approval is recorded against version 3 (SHA-256 9f2c4e1a…a6). The decision is then ready for a publishing officer. It is not yet public."
        : o.action === "request_revision"
          ? "The decision returns to its author with your reasons. A revised version will need adoption and approval again."
          : "The decision is closed with your reasons, and its author is told.",
    reasonLabel: o.action === "approve" ? undefined : "Reason, shown to the author",
  }));

  const stageAt = ["2026-10-13T09:12:00Z", "2026-10-13T09:40:00Z", "2026-10-14T11:05:00Z", "2026-10-15T10:31:00Z"];
  const stages: Stage[] = def.stages.map((s, i) => ({
    state: s,
    status: i < 3 ? "done" : i === 3 ? "current" : "upcoming",
    actor: ["Tobias Aldridge", "Tobias Aldridge", "Ilse van der Westhuizen", "Marie-Thérèse N’Diaye"][i],
    at: i <= 3 ? stageAt[i] : undefined,
    note: i === 3 ? "Awaiting approval by a second officer" : undefined,
  }));

  return (
    <Folio
      header={{
        reference: row.reference,
        register: "Decisions",
        institution: row.institution,
        classification: "public",
        state: "adopted",
        version: 3,
        versionNote: "revised 14 Oct",
        author: "Tobias Aldridge",
        title: row.title,
      }}
      body={
        <>
          {specimenBody.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </>
      }
      custody={
        <>
          <NextAction offers={offers} noneText="You have no step to take on this record." />
          <CustodySection title="Stages">
            <Stepper stages={stages} />
          </CustodySection>
          <CustodySection title="Countersignatures" aside={<span className="text-meta text-ink-3">Version 3</span>}>
            <div className="grid gap-4">
              <Countersignature
                s={{ name: "Marie-Thérèse N’Diaye", role: "Approving officer", institution: "Council of States", decision: "adopted", at: "2026-10-15T10:31:00Z", version: 3, versionHash: HASH }}
              />
              <Countersignature
                s={{
                  name: "Ilse van der Westhuizen",
                  role: "Reviewer",
                  institution: "Council of States",
                  decision: "revision_requested",
                  at: "2026-10-14T08:20:00Z",
                  version: 2,
                  versionHash: "41b07c2d9e8f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b",
                  reason: "Set the quorum as a majority, as agreed at the founding session, and state when minutes are published.",
                }}
              />
            </div>
          </CustodySection>
          <CustodySection title="Before it can be published">
            <Eligibility conditions={publicationEligibility(def, facts)} />
          </CustodySection>
          <CustodySection title="Attachments">
            <AttachmentRow a={{ id: "a1", name: "Minutes of the founding session of the Council of States, 9 October 2026.pdf", type: "pdf", bytes: 1_482_112, scan: "unscanned" }} />
            <AttachmentRow a={{ id: "a2", name: "Quorum options note.pdf", type: "pdf", bytes: 88_064, scan: "clean" }} />
          </CustodySection>
          <CustodySection title="Comments">
            <CommentThread
              comments={[
                {
                  id: "c1",
                  author: "Ilse van der Westhuizen",
                  role: "Reviewer",
                  at: "2026-10-14T08:20:00Z",
                  passage: "A quorum is one third of the members appointed",
                  body: "One third is lower than the founding session agreed. Please set it as a majority.",
                },
                { id: "c2", author: "Tobias Aldridge", role: "Author", at: "2026-10-14T11:02:00Z", body: "Changed to a majority in version 3, and added the ten-day rule for minutes." },
              ]}
            />
          </CustodySection>
        </>
      }
    />
  );
}
