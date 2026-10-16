import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { WorkbenchHeading } from "@/components/workbench/WorkbenchHeading";
import { ConfirmTwoStepForm } from "@/features/auth/TwoStepForms";
import { requireUser } from "@/server/auth/current-user";
import { totpUri } from "@/server/auth/totp";
import { pendingTwoStep } from "@/server/services/users";

export const metadata = { title: "Set up two-step sign-in" };

export default async function TwoStepSetup() {
  const user = await requireUser();
  const secret = await pendingTwoStep(user.id);
  if (!secret) redirect("/workbench/account#two-step");
  const qr = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 176 });

  return (
    <>
      <p className="mb-6 text-[0.875rem]">
        <Link href="/workbench/account#two-step" className="link-ledger">
          ← Account and security
        </Link>
      </p>
      <WorkbenchHeading eyebrow="Account and security" title="Set up two-step sign-in">
        Optional, and about a minute. Once it is on, every sign-in asks for your password and a code from your phone. You can turn it off again at any time.
      </WorkbenchHeading>
      <ol className="grid max-w-2xl gap-10">
        <li>
          <p className="font-semibold">1. Scan this code with an authenticator app on your phone</p>
          <p className="mt-1 text-[0.9375rem] text-ink-600">For example Microsoft Authenticator, Google Authenticator, 1Password or Bitwarden.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI drawn on the server */}
          <img src={qr} width={176} height={176} alt="QR code for your authenticator app" className="mt-4 border border-[var(--rule-ledger)]" />
          <details className="mt-3 text-[0.875rem] text-ink-600">
            <summary className="cursor-pointer font-semibold">Cannot scan? Enter this key instead</summary>
            <p className="t-ref mt-2 break-all">{secret.replace(/(.{4})/g, "$1 ").trim()}</p>
          </details>
        </li>
        <li>
          <p className="font-semibold">2. Enter the six-digit code the app shows</p>
          <ConfirmTwoStepForm />
        </li>
      </ol>
    </>
  );
}
