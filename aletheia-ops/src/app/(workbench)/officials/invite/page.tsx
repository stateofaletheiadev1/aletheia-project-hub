import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { CLASSIFICATION, CLASSIFICATIONS } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { institutionsWhere, PRIVILEGED_ROLES, ROLE_INFO, ROLES } from "@/policy/roles";
import { requireOfficial } from "@/server/session";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Invite an official" };

export default async function InvitePage() {
  const { actor } = await requireOfficial();
  const where = institutionsWhere(actor, "official.invite");
  if (where !== "*" && where.length === 0) notFound();
  const institutions = [...(where === "*" ? [{ value: "*", label: "All institutions" }] : []), ...INSTITUTION_SEED.filter((i) => where === "*" || where.includes(i.slug)).map((i) => ({ value: i.slug, label: i.name }))];
  return (
    <div className="mx-auto grid max-w-7xl gap-8">
      <PageHeader
        overline={<SectionMark n="I2">Officials and access</SectionMark>}
        title="Invite an official"
        lede="The official receives a single-use link, chooses a password and sets up an authenticator app. Nobody else ever sees their password."
      />
      <InviteForm
        roles={ROLES.map((r) => ({ value: r, label: ROLE_INFO[r].label, privileged: PRIVILEGED_ROLES.includes(r) }))}
        institutions={institutions}
        clearances={CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION[c].label }))}
      />
    </div>
  );
}
