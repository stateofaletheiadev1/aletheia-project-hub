import { specimenNow, specimenRows, type SpecimenRow } from "@fixtures/specimens";
import { FilterBar } from "@/components/patterns/FilterBar";
import { RegisterTable, type Column } from "@/components/patterns/RegisterTable";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyRegister, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Reference } from "@/components/ui/Reference";
import { ClassificationTag, StatusTag } from "@/components/ui/tags";
import { Timestamp } from "@/components/ui/Timestamp";
import { CLASSIFICATION, CLASSIFICATIONS, RECORD_STATE, RECORD_STATES } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { REGISTER, placeholderReference } from "@/domain/registers";
import { formatDue } from "@/lib/time";
import { cx } from "@/lib/cx";

// Register archetype with specimen content. `?state=empty` shows the empty register;
// `?density=compact` the compact density.

export default async function RegisterSpecimen({ searchParams }: { searchParams: Promise<{ state?: string; density?: string }> }) {
  const sp = await searchParams;
  const rows = sp.state === "empty" ? [] : specimenRows;
  const info = REGISTER.decisions;
  const columns: Column<SpecimenRow>[] = [
    { key: "ref", header: "Reference", width: "w-44", render: (r) => <Reference value={r.reference} /> },
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <span className="block py-2">
          <span className="line-clamp-2 font-semibold text-ink group-hover:text-authority">{r.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
            {r.institution}
            {r.classification !== "public" ? <ClassificationTag value={r.classification} /> : null}
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", width: "w-48", render: (r) => <StatusTag state={r.state} /> },
    { key: "assignee", header: "With", width: "w-44", hideBelow: "2xl", render: (r) => <span className="line-clamp-1 text-ink-2">{r.assignee}</span> },
    { key: "updated", header: "Updated", width: "w-28", align: "right", hideBelow: "xl", render: (r) => <Timestamp at={r.updatedAt} now={specimenNow} className="text-ink-2" /> },
    {
      key: "due",
      header: "Due",
      width: "w-32",
      align: "right",
      render: (r) => {
        if (!r.dueAt) return <span className="text-ink-3">—</span>;
        const d = formatDue(new Date(r.dueAt), specimenNow);
        return <span className={cx("tnum text-meta whitespace-nowrap", d.overdue ? "font-semibold text-status-danger" : "text-ink-2")}>{d.text}</span>;
      },
    },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader
        overline={<SectionMark n="R2">The record</SectionMark>}
        title={info.label}
        lede={info.description}
        meta={<p className="text-meta text-ink-2">Publication rule: {info.publicationRule}</p>}
        actions={<ButtonLink href="/design/folio" variant="primary">New decision</ButtonLink>}
      />
      <FilterBar
        action="/design/register"
        values={{}}
        filters={[
          { name: "institution", label: "Institution", options: INSTITUTION_SEED.map((i) => ({ value: i.slug, label: i.shortName })) },
          { name: "status", label: "Status", options: RECORD_STATES.map((s) => ({ value: s, label: RECORD_STATE[s].label })) },
          { name: "classification", label: "Classification", options: CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION[c].label })) },
        ]}
        total={{ shown: rows.length, of: rows.length }}
      />
      {rows.length === 0 ? (
        <EmptyRegister placeholder={placeholderReference(info.referenceType)} title="No decisions yet.">
          <p>{info.emptyText}</p>
        </EmptyRegister>
      ) : (
        <>
          <RegisterTable
            caption="Decisions"
            columns={columns}
            rows={rows}
            rowHref={() => "/design/folio"}
            isNew={(r) => Boolean(r.isNew)}
            density={sp.density === "compact" ? "compact" : "comfortable"}
            sortedBy={{ key: "updated", direction: "descending" }}
            card={(r) => (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Reference value={r.reference} />
                  <StatusTag state={r.state} />
                </div>
                <p className="text-ui font-semibold text-ink">{r.title}</p>
                <p className="text-meta text-ink-2">
                  {r.institution} · <Timestamp at={r.updatedAt} now={specimenNow} />
                </p>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
