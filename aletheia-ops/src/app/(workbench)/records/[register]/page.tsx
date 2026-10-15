import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/patterns/FilterBar";
import { Pagination } from "@/components/patterns/Pagination";
import { RegisterTable, type Column } from "@/components/patterns/RegisterTable";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyRegister, InlineAlert, PageHeader, SectionMark } from "@/components/ui/feedback";
import { Reference } from "@/components/ui/Reference";
import { ClassificationTag, StatusTag } from "@/components/ui/tags";
import { Timestamp } from "@/components/ui/Timestamp";
import { CLASSIFICATION, CLASSIFICATIONS, RECORD_STATE, RECORD_STATES, type Classification, type RecordState } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { institutionName } from "@/domain/labels";
import { isRegister, placeholderReference, REGISTER, REGISTERS } from "@/domain/registers";
import { can, institutionsWhere } from "@/policy/roles";
import { DEFINITIONS } from "@/workflow/definitions";
import type { Doc } from "@/ports/store";
import { namesOf } from "@/services/identity/identity";
import { listRecords } from "@/services/records/records";
import type { RecordDoc } from "@/services/records/types";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ register: string }> }): Promise<Metadata> {
  const { register } = await params;
  return { title: isRegister(register) ? REGISTER[register].label : "Register" };
}

type Search = { q?: string; institution?: string; status?: string; classification?: string; page?: string };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ register: string }>; searchParams: Promise<Search> }) {
  const { register } = await params;
  if (!isRegister(register)) notFound();
  const { official, actor } = await requireOfficial();
  const where = institutionsWhere(actor, "record.read");
  if (where !== "*" && where.length === 0) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = {
    register,
    q: sp.q,
    institution: INSTITUTION_SEED.some((i) => i.slug === sp.institution) ? sp.institution : undefined,
    state: (RECORD_STATES as readonly string[]).includes(sp.status ?? "") ? (sp.status as RecordState) : undefined,
    classification: (CLASSIFICATIONS as readonly string[]).includes(sp.classification ?? "") ? (sp.classification as Classification) : undefined,
  };
  const d = await requireDeps();
  const { rows, total } = await listRecords(d, actor, filter, page, 25);
  const names = await namesOf(d, rows.map((r) => r.updatedBy));
  const info = REGISTER[register];
  const creates = institutionsWhere(actor, "record.create");
  const tz = official.timezone;
  const now = new Date();
  const n = REGISTERS.indexOf(register) + 1;

  const columns: Column<Doc<RecordDoc>>[] = [
    { key: "ref", header: "Reference", width: "w-44", render: (r) => <Reference value={r.reference ?? placeholderReference(info.referenceType)} /> },
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <span className="block py-2">
          <span className="line-clamp-2 font-semibold text-ink group-hover:text-authority">{r.draft.title || "Untitled"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
            {institutionName(r.institution)}
            {r.classification !== "public" ? <ClassificationTag value={r.classification} /> : null}
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", width: "w-52", render: (r) => <StatusTag state={r.state} /> },
    { key: "by", header: "Last changed by", width: "w-44", hideBelow: "2xl", render: (r) => <span className="line-clamp-1 text-ink-2">{names.get(r.updatedBy) ?? "System"}</span> },
    { key: "updated", header: "Updated", width: "w-28", align: "right", render: (r) => <Timestamp at={r.updatedAt} now={now} timeZone={tz} className="text-ink-2" /> },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader
        overline={<SectionMark n={`R${n}`}>The record</SectionMark>}
        title={info.label}
        lede={info.description}
        meta={
          <div className="grid gap-1.5">
            <p className="text-meta text-ink-2">Publication rule: {info.publicationRule}</p>
            <p className="text-meta text-ink-2">
              <span className="font-semibold text-ink">How a {info.noun} moves: </span>
              {DEFINITIONS[register].stages.map((s) => RECORD_STATE[s].label).join(" → ")}. At any review stage it can be returned to its author with reasons, or rejected.
            </p>
          </div>
        }
        actions={creates === "*" || creates.length ? <ButtonLink href={`/records/${register}/new`} variant="primary">{`New ${info.noun}`}</ButtonLink> : undefined}
      />
      <FilterBar
        action={`/records/${register}`}
        query={sp.q}
        values={{ institution: filter.institution, status: filter.state, classification: filter.classification }}
        filters={[
          { name: "institution", label: "Institution", options: INSTITUTION_SEED.filter((i) => where === "*" || where.includes(i.slug)).map((i) => ({ value: i.slug, label: i.shortName })) },
          { name: "status", label: "Status", options: RECORD_STATES.map((s) => ({ value: s, label: RECORD_STATE[s].label })) },
          { name: "classification", label: "Classification", options: CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION[c].label })) },
        ]}
        total={{ shown: rows.length, of: total }}
      />
      {creates !== "*" && creates.length === 0 ? (
        <InlineAlert title={`You cannot start a ${info.noun}`}>
          New records are started by officials with the <span className="font-semibold">Author</span> role in an institution, then reviewed, approved and released by others. Administrators
          manage people and access, not records. {can(actor, "official.invite") ? "Give yourself or others the Author role by asking another administrator under Officials and access; nobody can change their own access." : "Ask an administrator for the Author role."}
        </InlineAlert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyRegister placeholder={placeholderReference(info.referenceType)} title={filter.q || filter.institution || filter.state || filter.classification ? "No records match these filters." : `No ${info.label.toLowerCase()} yet.`}>
          <p>{info.emptyText}</p>
        </EmptyRegister>
      ) : (
        <>
          <RegisterTable
            caption={info.label}
            columns={columns}
            rows={rows}
            rowHref={(r) => `/records/${register}/${r.id}`}
            density={official.density}
            sortedBy={{ key: "updated", direction: "descending" }}
            card={(r) => (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Reference value={r.reference ?? placeholderReference(info.referenceType)} />
                  <StatusTag state={r.state} />
                </div>
                <p className="text-ui font-semibold text-ink">{r.draft.title || "Untitled"}</p>
                <p className="text-meta text-ink-2">
                  {institutionName(r.institution)} · <Timestamp at={r.updatedAt} now={now} timeZone={tz} />
                </p>
              </div>
            )}
          />
          <Pagination
            page={page}
            pageSize={25}
            total={total}
            href={(p) => {
              const q = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
              return `/records/${register}?${q}`;
            }}
          />
        </>
      )}
    </div>
  );
}
