import { specimenNow, specimenOfficial, specimenRows } from "@fixtures/specimens";
import { Briefing, type ActionItem } from "@/components/patterns/Briefing";
import { REGISTER } from "@/domain/registers";

// Briefing archetype with specimen content. `?state=empty` shows an institution in formation.

const ACTION: Partial<Record<string, string>> = {
  adopted: "Approve decision",
  under_review: "Review finance record",
  verified: "Approve appointment",
  submitted: "Take for review",
  publication_failed: "Retry publication",
};

export default async function BriefingSpecimen({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const empty = (await searchParams).state === "empty";
  const rows = empty ? [] : specimenRows;
  const actions: ActionItem[] = rows
    .filter((r) => ACTION[r.state])
    .map((r) => ({
      id: r.id,
      href: "/design/folio",
      reference: r.reference,
      register: r.register,
      title: r.title,
      institution: r.institution,
      classification: r.classification,
      priority: r.priority,
      action: ACTION[r.state] ?? `Open ${REGISTER[r.register].noun}`,
      since: r.updatedAt,
      dueAt: r.dueAt,
    }));
  return (
    <Briefing
      official={specimenOfficial}
      institution={{ name: specimenOfficial.institution, status: "Proposed" }}
      now={specimenNow}
      actions={actions.slice(0, 4)}
      due={actions.filter((a) => a.dueAt)}
      moving={rows
        .filter((r) => ["draft", "submitted", "revision_requested", "under_review"].includes(r.state))
        .map((r) => ({ id: r.id, href: "/design/folio", reference: r.reference, title: r.title, state: r.state, assignee: r.assignee, updatedAt: r.updatedAt }))}
      published={rows
        .filter((r) => r.state === "published")
        .map((r) => ({ id: r.id, reference: r.reference, title: r.title, register: r.register, publicUrl: "https://www.aletheiagov.org/documents", publishedAt: r.updatedAt }))}
      warnings={
        empty
          ? []
          : [
              {
                id: "w1",
                tone: "danger",
                title: "A publication was refused by aletheiagov.org",
                detail: "Statement of contributions received for the founding programme: the portal reported that the content hash did not match the submitted text. Nothing was published.",
                href: "/design/folio",
              },
            ]
      }
      inFormation={empty}
    />
  );
}
