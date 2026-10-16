import Link from "next/link";
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
      notice={
        e.AUTH_MFA === "optional" && !official.totpSealed ? (
          <p role="status" className="border-b border-status-returned bg-status-returned-tint px-5 py-2 text-ui font-semibold text-status-returned">
            You sign in with a password only. You can turn on two-step sign-in at any time, for a second layer of protection, in{" "}
            <Link href="/account#two-step" className="underline underline-offset-2">
              Your account
            </Link>
            .
          </p>
        ) : undefined
      }
    >
      {children}
    </AppFrame>
  );
}
