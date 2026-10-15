import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Countersignature,
  PublicationReceipt,
  Stepper,
  type Signature,
  type Stage,
} from "@/components/patterns/custody";
import {
  CustodySection,
  Eligibility,
  Folio,
} from "@/components/patterns/Folio";
import { NextAction, type StepOffer } from "@/components/patterns/NextAction";
import { RecordBody } from "@/components/patterns/RecordBody";
import { ButtonLink } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/feedback";
import { Timestamp } from "@/components/ui/Timestamp";
import { contentProblems } from "@/domain/content";
import { institutionName } from "@/domain/labels";
import { isRegister, placeholderReference, REGISTER } from "@/domain/registers";
import { can } from "@/policy/roles";
import { foundersAmong, namesOf } from "@/services/identity/identity";
import {
  approvalsOf,
  getRecord,
  offersFor,
  recordFacts,
  transitionsOf,
  versionsOf,
} from "@/services/records/records";
import { definitionById } from "@/workflow/definitions";
import { publicationEligibility } from "@/workflow/engine";
import { ACTION_LABEL } from "@/workflow/types";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";
import { stepAction } from "../../actions";
import {
  consequence,
  DANGER,
  NEEDS_REASON,
  PRIMARY_ORDER,
} from "../../consequences";

export const metadata: Metadata = { title: "Record" };

const SIGNED: Record<string, Signature["decision"]> = {
  approve: "approved",
  adopt: "adopted",
  verify: "verified",
  request_revision: "revision_requested",
  reject: "rejected",
  authorise_publication: "authorised",
};

const EDITABLE = ["draft", "revision_requested", "correction_in_progress"];

/** The capacity in which each step is taken, for the countersignature line. */
const STEP_ROLE: Record<string, string> = {
  approve: "Approving officer",
  adopt: "Approving officer",
  verify: "Appointments verifier",
  request_revision: "Reviewer",
  reject: "Reviewer",
  authorise_publication: "Publishing officer",
};

export default async function RecordPage({
  params,
}: {
  params: Promise<{ register: string; id: string }>;
}) {
  const { register, id } = await params;
  if (!isRegister(register)) notFound();
  const { official, actor } = await requireOfficial();
  const d = await requireDeps();
  const r = await getRecord(d, actor, id);
  if (!r || r.register !== register) notFound();
  const def = definitionById(r.workflowId)!;
  const [transitions, versions, approvals, offers, facts] = await Promise.all([
    transitionsOf(d, r.id),
    versionsOf(d, r.id),
    approvalsOf(d, r.id),
    offersFor(d, actor, r),
    recordFacts(d, r),
  ]);
  const people = [
    r.authorId,
    ...transitions.map((t) => t.actorId ?? ""),
    ...approvals.map((a) => a.officialId),
  ];
  const [names, founders] = await Promise.all([
    namesOf(d, people),
    foundersAmong(d, people),
  ]);
  const tz = official.timezone;
  const info = REGISTER[register];
  const shown = EDITABLE.includes(r.state)
    ? r.draft
    : versions[0]?.content ?? r.draft;

  // Stages: the definition's own path, with who completed each and when (brief §23).
  const reached = new Map<string, { actor: string | null; at: string }>();
  reached.set("draft", { actor: r.authorId, at: r.createdAt });
  for (const t of transitions)
    reached.set(t.to, { actor: t.actorId, at: t.at });
  const currentIndex = def.stages.indexOf(r.state);
  const stages: Stage[] = def.stages.map((s, i) => {
    const hit = reached.get(s);
    const status =
      currentIndex === -1
        ? hit
          ? "done"
          : "upcoming"
        : i < currentIndex
        ? "done"
        : i === currentIndex
        ? "current"
        : "upcoming";
    return {
      state: s,
      status,
      actor:
        hit && status !== "upcoming"
          ? hit.actor
            ? names.get(hit.actor) ?? "An official"
            : "aletheiagov.org"
          : undefined,
      at: status !== "upcoming" ? hit?.at : undefined,
    };
  });

  const signatures: Signature[] = transitions
    .filter((t) => SIGNED[t.action] && t.actorId)
    .reverse()
    .map((t) => ({
      name: names.get(t.actorId!) ?? "An official",
      role: founders.has(t.actorId!)
        ? "Founder"
        : t.action === "approve" && register === "finance"
        ? "Finance officer"
        : STEP_ROLE[t.action] ?? "Officer",
      institution: institutionName(r.institution),
      decision: SIGNED[t.action]!,
      at: t.at,
      version: t.versionNumber ?? 0,
      versionHash: t.versionHash ?? "",
      reason: t.reason ?? undefined,
    }));

  const rank = (a: string) =>
    PRIMARY_ORDER.includes(a as never)
      ? PRIMARY_ORDER.indexOf(a as never)
      : PRIMARY_ORDER.length;
  const ordered = [...offers].sort((a, b) => rank(a.action) - rank(b.action));
  const firstAllowed = ordered.find(
    (o) => o.allowed && PRIMARY_ORDER.includes(o.action)
  );
  // What must be fixed in the text before it can be submitted, shown before anyone clicks.
  const contentIssues = EDITABLE.includes(r.state)
    ? contentProblems(r.draft, register).map((p) => p.message)
    : [];
  const stepOffers: StepOffer[] = ordered.map((o) => {
    const blockedByText = o.action === "submit" && contentIssues.length > 0;
    return {
      action: o.action,
      label: ACTION_LABEL[o.action].replace("{noun}", info.noun),
      allowed: o.allowed && !blockedByText,
      reasons: blockedByText
        ? [...contentIssues, "Use “Edit the draft” above to fix it."]
        : o.allowed
        ? undefined
        : o.reasons,
      primary: o === firstAllowed,
      danger: DANGER.includes(o.action),
      consequence: consequence(o.action, register, {
        version: r.currentVersion?.number,
        reference: r.reference,
      }),
      reasonLabel: NEEDS_REASON.includes(o.action)
        ? o.action === "withdraw"
          ? "Reason, recorded"
          : "Reason, shown to the author"
        : undefined,
    };
  });
  const canEdit =
    EDITABLE.includes(r.state) &&
    can(actor, "record.edit", {
      institution: r.institution,
      classification: r.classification,
    });
  const lastRevision = [...transitions]
    .reverse()
    .find((t) => t.action === "request_revision");

  return (
    <Folio
      banner={
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/records/${register}`}
            className="text-meta font-semibold text-authority hover:underline"
          >
            ← {info.label}
          </Link>
          <div className="flex gap-2">
            {versions.length > 1 ? (
              <ButtonLink
                href={`/records/${register}/${r.id}/changes`}
                size="sm"
              >
                Changes from version {versions[1]!.number}
              </ButtonLink>
            ) : null}
            {canEdit ? (
              <ButtonLink
                href={`/records/${register}/${r.id}/edit`}
                size="sm"
                variant="secondary"
              >
                Edit the draft
              </ButtonLink>
            ) : null}
          </div>
        </div>
      }
      header={{
        reference: r.reference ?? placeholderReference(info.referenceType),
        register: info.label,
        institution: institutionName(r.institution),
        classification: r.classification,
        state: r.state,
        version: r.currentVersion?.number ?? 0,
        versionNote:
          EDITABLE.includes(r.state) && r.currentVersion
            ? "draft changes not yet submitted"
            : r.currentVersion
            ? undefined
            : "not yet submitted",
        author: names.get(r.authorId) ?? "An official",
        title: shown.title || "Untitled",
      }}
      body={
        <>
          {r.state === "revision_requested" && lastRevision?.reason ? (
            <InlineAlert
              tone="warning"
              title="Revision requested"
              className="mb-8"
            >
              {lastRevision.reason}
            </InlineAlert>
          ) : null}
          {shown.summary ? <p className="text-ink-2">{shown.summary}</p> : null}
          {shown.body.length ? (
            <RecordBody body={shown.body} facts={shown.facts} />
          ) : (
            <p className="text-ink-3">No text yet.</p>
          )}
        </>
      }
      custody={
        <>
          <NextAction
            offers={stepOffers}
            noneText={`You have no step to take on this ${info.noun} at its current stage.`}
            onStep={stepAction.bind(null, r.id, register, r._rev)}
          />
          {r.publication ? (
            <CustodySection title="Publication">
              <PublicationReceipt r={r.publication} timeZone={tz} />
            </CustodySection>
          ) : null}
          <CustodySection title="Stages">
            <Stepper stages={stages} timeZone={tz} />
          </CustodySection>
          {signatures.length ? (
            <CustodySection title="Countersignatures">
              <div className="grid gap-4">
                {signatures.map((s, i) => (
                  <Countersignature key={i} s={s} timeZone={tz} />
                ))}
              </div>
            </CustodySection>
          ) : null}
          {!r.publication ? (
            <CustodySection title="Before it can be published">
              <Eligibility conditions={publicationEligibility(def, facts)} />
            </CustodySection>
          ) : null}
          <CustodySection title="Versions">
            {versions.length === 0 ? (
              <p className="text-ui text-ink-3">Not yet submitted.</p>
            ) : null}
            <ul className="grid">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="border-b border-rule py-2.5 last:border-b-0"
                >
                  <p className="text-ui font-semibold text-ink">
                    Version {v.number}
                  </p>
                  <p className="text-meta text-ink-2">
                    {v.authors
                      .map((a) => names.get(a) ?? "An official")
                      .join(", ")}{" "}
                    ·{" "}
                    <Timestamp at={v.createdAt} mode="datetime" timeZone={tz} />
                  </p>
                  <p
                    className="tnum text-meta text-ink-3"
                    title={`SHA-256 ${v.hash}`}
                  >
                    {v.hash.slice(0, 12)}…
                    {approvals.filter((a) => a.versionHash === v.hash).length
                      ? ` · approved by ${approvals
                          .filter((a) => a.versionHash === v.hash)
                          .map((a) => names.get(a.officialId) ?? "an officer")
                          .join(", ")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </CustodySection>
        </>
      }
    />
  );
}
