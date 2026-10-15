import { Briefing, type ActionItem, type MovingItem, type PublishedItem, type Warning } from "@/components/patterns/Briefing";
import { GettingStarted } from "@/components/patterns/GettingStarted";
import { InlineAlert } from "@/components/ui/feedback";
import { INSTITUTION_STATE } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { institutionName, primaryTitle } from "@/domain/labels";
import { placeholderReference, REGISTER } from "@/domain/registers";
import { can } from "@/policy/roles";
import { listOfficials, listPendingChanges, namesOf } from "@/services/identity/identity";
import { listRecords, queueFor } from "@/services/records/records";
import { definitionById } from "@/workflow/definitions";
import { dueAt } from "@/workflow/engine";
import { ACTION_LABEL } from "@/workflow/types";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// The Briefing (brief §18.1): what needs this official, what is due, what is moving, what was
// published. Every item comes from records this official may see.

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { official, actor } = await requireOfficial();
  const d = await requireDeps();
  const now = d.now();
  const [pending, queue, recent] = await Promise.all([listPendingChanges(d, actor), queueFor(d, actor), listRecords(d, actor, {}, 1, 60)]);
  const awaiting = pending.filter((p) => p.proposedBy !== official.id);
  const title = primaryTitle(official.grants);
  const first = official.grants.find((g) => g.institution !== "*");
  const institution = first ? INSTITUTION_SEED.find((i) => i.slug === first.institution) : undefined;

  const actions: ActionItem[] = queue.map(({ record: r, offers }) => {
    const def = definitionById(r.workflowId);
    const due = def ? dueAt(def, r.state, new Date(r.stateEnteredAt)) : null;
    const info = REGISTER[r.register];
    return {
      id: r.id,
      href: `/records/${r.register}/${r.id}`,
      reference: r.reference ?? placeholderReference(info.referenceType),
      register: r.register,
      title: r.draft.title || "Untitled",
      institution: institutionName(r.institution),
      classification: r.classification,
      priority: r.priority,
      action: ACTION_LABEL[offers[0]!.action].replace("{noun}", info.noun),
      since: r.stateEnteredAt,
      dueAt: due?.toISOString(),
    };
  });
  const inProgress = recent.rows.filter((r) => !["published", "archived", "withdrawn", "rejected"].includes(r.state)).slice(0, 8);
  const names = await namesOf(d, inProgress.map((r) => r.updatedBy));
  const moving: MovingItem[] = inProgress.map((r) => ({
    id: r.id,
    href: `/records/${r.register}/${r.id}`,
    reference: r.reference ?? placeholderReference(REGISTER[r.register].referenceType),
    title: r.draft.title || "Untitled",
    state: r.state,
    assignee: names.get(r.updatedBy) ?? "",
    updatedAt: r.updatedAt,
  }));
  const published: PublishedItem[] = recent.rows
    .filter((r) => r.publication)
    .slice(0, 5)
    .map((r) => ({ id: r.id, reference: r.publication!.reference, title: r.draft.title, register: r.register, publicUrl: r.publication!.url, publishedAt: r.publication!.publishedAt }));
  const warnings: Warning[] = [
    ...(awaiting.length
      ? [
          {
            id: "access",
            tone: "warning" as const,
            title: awaiting.length === 1 ? "An access change is waiting for a second administrator" : `${awaiting.length} access changes are waiting for a second administrator`,
            detail: "Privileged roles take effect only when an administrator other than the one who proposed them confirms.",
            href: "/officials",
          },
        ]
      : []),
    ...recent.rows
      .filter((r) => r.state === "publication_failed")
      .map((r) => ({ id: `pf-${r.id}`, tone: "danger" as const, title: "A publication was refused", detail: `${r.draft.title}: see the record for the portal's reason.`, href: `/records/${r.register}/${r.id}` })),
  ];
  const showGuide = can(actor, "official.invite") && recent.total === 0;
  const officials = showGuide ? (await listOfficials(d, actor)).length : 0;
  const welcome = (await searchParams).welcome === "1";

  return (
    <>
      {welcome ? (
        <InlineAlert tone="success" title={`Welcome, ${official.name}`} className="mx-auto mb-8 max-w-7xl">
          Your account is active. Every step you take here is recorded in the audit register under your name.
        </InlineAlert>
      ) : null}
      {showGuide ? <GettingStarted officials={officials} /> : null}
      <Briefing
        official={{ name: official.name, role: title.role }}
        institution={institution ? { name: institution.name, status: INSTITUTION_STATE[institution.status].label } : null}
        now={now}
        timeZone={official.timezone}
        actions={actions.slice(0, 6)}
        due={actions.filter((a) => a.dueAt && new Date(a.dueAt).getTime() < now.getTime() + 7 * 86_400_000)}
        moving={moving}
        published={published}
        warnings={warnings}
        inFormation={recent.total === 0}
      />
    </>
  );
}
