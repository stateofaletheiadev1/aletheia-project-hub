import type { Metadata } from "next";
import { PageHead } from "@/components/editorial/PageHead";
import { applicationsOpen } from "@/components/records/RecordPage";
import { institutions } from "@/content/institutions";
import type { ApplyingFor } from "@/features/interest/InterestForm";
import { InterestSection } from "@/features/interest/InterestSection";
import { getPublished } from "@/server/records/public-records";

export const metadata: Metadata = {
  title: "Register your interest",
  description: "Register your interest in founding roles and other positions in the institutions of the Sovereign Covenant State of Aletheia, or apply for a published position.",
};

/** The position being applied for, if the address names one that is published and open. */
async function position(reference: string | undefined): Promise<ApplyingFor | undefined> {
  if (!reference || !/^AGV-OPP-\d{4}-\d{4,}$/.test(reference)) return undefined;
  const record = await getPublished("opportunity", reference.toLowerCase());
  if (!record || record === "unavailable" || record.withdrawn || !applicationsOpen(record.closingDate)) return undefined;
  // The record carries the institution's name; the form preselects by slug.
  const institution = institutions.find((i) => i.name === record.issuer)?.slug;
  return { reference: record.reference, title: record.title, positionType: record.positionType ?? "founding", institution };
}

export default async function RegisterInterestPage({ searchParams }: { searchParams: Promise<{ opportunity?: string }> }) {
  const applyingFor = await position((await searchParams).opportunity);
  return (
    <>
      <PageHead
        mark={{ n: "P4", label: "Take part" }}
        title={applyingFor ? "Apply for a position" : "Register your interest"}
        lede={
          applyingFor
            ? `You are applying for ${applyingFor.title} (${applyingFor.reference}). Give your details and attach your CV; the position's kind and institution are already ticked, and you may add others.`
            : "Tell the government which positions you are interested in: founding roles, and permanent, fixed-term, advisory or volunteer positions. One registration covers as many kinds of position and institutions as you choose."
        }
        image="evening-sea"
      />
      <InterestSection mark="01" applyingFor={applyingFor} />
    </>
  );
}
