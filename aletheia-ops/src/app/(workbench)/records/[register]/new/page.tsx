import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { CLASSIFICATION } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { isRegister, REGISTER } from "@/domain/registers";
import { institutionsWhere } from "@/policy/roles";
import { classificationsFor } from "@/services/records/records";
import { requireOfficial } from "@/server/session";
import { Composer } from "../../Composer";

export const metadata: Metadata = { title: "New draft" };

export default async function NewRecordPage({ params }: { params: Promise<{ register: string }> }) {
  const { register } = await params;
  if (!isRegister(register)) notFound();
  const { official, actor } = await requireOfficial();
  const where = institutionsWhere(actor, "record.create");
  const institutions = INSTITUTION_SEED.filter((i) => where === "*" || where.includes(i.slug));
  if (institutions.length === 0) notFound();
  const first = institutions[0]!.slug;
  const classes = classificationsFor(actor, first);
  const info = REGISTER[register];
  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <PageHeader overline={<SectionMark n="R">{info.label}</SectionMark>} title={`New ${info.noun}`} lede="A draft is visible to officials of its institution who are cleared for its classification. Nothing is public until approved and released." />
      <Composer
        mode="new"
        register={register}
        noun={info.noun}
        institutions={institutions.map((i) => ({ value: i.slug, label: i.name }))}
        classifications={classes.map((c) => ({ value: c, label: CLASSIFICATION[c].label }))}
        initial={{ title: "", summary: "", body: "", facts: "", classification: register === "finance" && classes.includes("restricted") ? "restricted" : (classes[0] ?? "internal"), institution: first }}
        timeZone={official.timezone}
        backHref={`/records/${register}`}
      />
    </div>
  );
}
