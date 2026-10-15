import { Briefing, type Warning } from "@/components/patterns/Briefing";
import { InlineAlert } from "@/components/ui/feedback";
import { INSTITUTION_STATE } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { primaryTitle } from "@/domain/labels";
import { listPendingChanges } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// The Briefing (brief §18.1). Records are not held in the workbench yet, so the record sections
// say so; access changes waiting for this official are real and shown as warnings.

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { official, actor } = await requireOfficial();
  const d = await requireDeps();
  const pending = (await listPendingChanges(d, actor)).filter((p) => p.proposedBy !== official.id);
  const title = primaryTitle(official.grants);
  const first = official.grants.find((g) => g.institution !== "*");
  const institution = first ? INSTITUTION_SEED.find((i) => i.slug === first.institution) : undefined;
  const warnings: Warning[] = pending.length
    ? [
        {
          id: "access",
          tone: "warning",
          title: pending.length === 1 ? "An access change is waiting for a second administrator" : `${pending.length} access changes are waiting for a second administrator`,
          detail: "Privileged roles take effect only when an administrator other than the one who proposed them confirms.",
          href: "/officials",
        },
      ]
    : [];
  const welcome = (await searchParams).welcome === "1";
  return (
    <>
      {welcome ? (
        <InlineAlert tone="success" title={`Welcome, ${official.name}`} className="mx-auto mb-8 max-w-7xl">
          Your account is active. Every step you take here is recorded in the audit register under your name.
        </InlineAlert>
      ) : null}
      <Briefing
        official={{ name: official.name, role: title.role }}
        institution={institution ? { name: institution.name, status: INSTITUTION_STATE[institution.status].label } : null}
        now={new Date()}
        timeZone={official.timezone}
        actions={[]}
        due={[]}
        moving={[]}
        published={[]}
        warnings={warnings}
        inFormation
      />
    </>
  );
}
