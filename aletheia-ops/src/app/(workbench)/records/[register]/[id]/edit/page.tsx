import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InlineAlert, PageHeader, SectionMark } from "@/components/ui/feedback";
import { bodyToText, factsToText } from "@/domain/content";
import { CLASSIFICATION } from "@/domain/glossary";
import { isRegister, REGISTER } from "@/domain/registers";
import { can } from "@/policy/roles";
import { classificationsFor, getRecord } from "@/services/records/records";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";
import { Composer } from "../../../Composer";

export const metadata: Metadata = { title: "Edit draft" };

const EDITABLE = ["draft", "revision_requested", "correction_in_progress"];

export default async function EditRecordPage({ params, searchParams }: { params: Promise<{ register: string; id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { register, id } = await params;
  if (!isRegister(register)) notFound();
  const { official, actor } = await requireOfficial();
  const r = await getRecord(await requireDeps(), actor, id);
  if (!r || r.register !== register) notFound();
  if (!EDITABLE.includes(r.state) || !can(actor, "record.edit", { institution: r.institution, classification: r.classification })) redirect(`/records/${register}/${id}`);
  const info = REGISTER[register];
  const created = (await searchParams).created === "1";
  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <PageHeader overline={<SectionMark n="R">{info.label}</SectionMark>} title={r.state === "draft" ? `Draft ${info.noun}` : r.state === "revision_requested" ? "Revise this draft" : "Correct the published text"} />
      {created ? (
        <InlineAlert tone="success" title="Draft created">
          Write the text, then return to the record to submit it for review. Drafts save automatically.
        </InlineAlert>
      ) : null}
      <Composer
        mode="edit"
        register={register}
        noun={info.noun}
        id={r.id}
        rev={r._rev}
        institutions={[]}
        classifications={classificationsFor(actor, r.institution).map((c) => ({ value: c, label: CLASSIFICATION[c].label }))}
        initial={{
          title: r.draft.title,
          summary: r.draft.summary,
          body: bodyToText(r.draft.body),
          facts: factsToText(r.draft.facts),
          classification: r.classification,
          sourceDocument: r.draft.sourceDocument,
          disclosureAuthorised: r.draft.disclosureAuthorised,
          positionType: r.draft.positionType,
          closingDate: r.draft.closingDate,
        }}
        timeZone={official.timezone}
        backHref={`/records/${register}/${id}`}
      />
    </div>
  );
}
