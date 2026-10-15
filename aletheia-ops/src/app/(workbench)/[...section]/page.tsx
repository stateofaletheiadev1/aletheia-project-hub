import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { navigationFor } from "@/components/frame/navigation";
import { EmptyRegister, PageHeader, SectionMark } from "@/components/ui/feedback";
import { isRegister, placeholderReference, REGISTER } from "@/domain/registers";
import { requireOfficial } from "@/server/session";

// Sections in the navigation that are not built yet. Each says so plainly, rather than showing
// an empty screen that looks finished (brief §3.1). Anything not in the official's own
// navigation is a 404, so this page reveals nothing about what others can see.

export const metadata: Metadata = { title: "Not open yet" };

const PHASE: Record<string, string> = {
  "/queue": "My queue opens with the records phase, when drafts and reviews are held here.",
  "/institution": "Work assigned to your institution opens with the records phase.",
  "/institutions": "The directory of institutions and positions opens after the records phase.",
  "/publications": "The publication log opens with publication to aletheiagov.org.",
  "/integrations": "Integration health opens with publication to aletheiagov.org.",
  "/settings/policies": "Workflow policies are defined in the code for now (docs/security/PERMISSION_MATRIX.md). Changing them here, under the two-person rule, comes later.",
  "/settings/notifications": "Notifications open with the records phase.",
  "/settings/system": "System information opens with integration health.",
  "/notifications": "Notifications open with the records phase.",
};

export default async function NotOpenYet({ params }: { params: Promise<{ section: string[] }> }) {
  const { actor } = await requireOfficial();
  const path = `/${(await params).section.join("/")}`;
  const known = navigationFor(actor).flatMap((g) => g.items.map((i) => i.href));
  if (!known.includes(path) && path !== "/notifications") notFound();

  const register = path.startsWith("/records/") ? path.slice("/records/".length) : null;
  if (register && isRegister(register)) {
    const info = REGISTER[register];
    return (
      <div className="mx-auto grid max-w-7xl gap-6">
        <PageHeader overline={<SectionMark n="R">The record</SectionMark>} title={info.label} lede={info.description} meta={<p className="text-meta text-ink-2">Publication rule: {info.publicationRule}</p>} />
        <EmptyRegister placeholder={placeholderReference(info.referenceType)} title="This register is not open yet.">
          <p>Records are not yet drafted or held in the workbench. The register opens with the records phase; until then nothing here is published to aletheiagov.org.</p>
        </EmptyRegister>
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader title="Not open yet" lede={PHASE[path] ?? "This part of the workbench is not built yet."} />
    </div>
  );
}
