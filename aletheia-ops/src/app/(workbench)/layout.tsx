import { AppFrame } from "@/components/frame/AppFrame";
import { navigationFor } from "@/components/frame/navigation";
import { primaryTitle } from "@/domain/labels";
import { env } from "@/lib/env";
import { formatTime } from "@/lib/time";
import { requireOfficial } from "@/server/session";

// The signed-in workbench. Every page below re-checks the session against the database here,
// and checks its own permissions; nothing is cached across officials (brief §35).

export const dynamic = "force-dynamic";

export default async function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  const { official, actor } = await requireOfficial();
  const e = env();
  const title = primaryTitle(official.grants);
  return (
    <AppFrame
      official={{ name: official.name, role: title.role, institution: title.institution }}
      environment={e.APP_ENV}
      unread={0}
      groups={navigationFor(actor)}
      build={e.BUILD_ID}
      simulatedPublication={e.PUBLICATION_MODE === "development"}
      footerNote={`Data as of ${formatTime(new Date(), official.timezone)}`}
    >
      {children}
    </AppFrame>
  );
}
