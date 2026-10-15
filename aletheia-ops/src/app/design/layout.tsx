import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SPECIMEN_NOTICE, specimenActor, specimenOfficial } from "@fixtures/specimens";
import { AppFrame } from "@/components/frame/AppFrame";
import { navigationFor } from "@/components/frame/navigation";
import { env } from "@/lib/env";

// The design reference (brief §13.3, §16): every component and archetype with specimen
// content. Never available in production.

export const metadata: Metadata = { title: "Design reference" };
export const dynamic = "force-dynamic";

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const e = env();
  if (e.APP_ENV === "production") notFound();
  const groups = navigationFor(specimenActor, { "/queue": 6, "/records/decisions": 2, "/records/finance": 3 });
  return (
    <AppFrame
      official={specimenOfficial}
      environment={e.APP_ENV}
      unread={3}
      groups={groups}
      build={e.BUILD_ID}
      simulatedPublication={e.PUBLICATION_MODE === "development"}
      footerNote="Data as of 15:42 WAT"
      notice={<p className="border-b border-rule bg-sheet px-5 py-2 text-meta font-semibold text-seal-ink">{SPECIMEN_NOTICE}</p>}
    >
      {children}
    </AppFrame>
  );
}
