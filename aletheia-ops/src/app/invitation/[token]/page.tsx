import type { Metadata } from "next";
import QRCode from "qrcode";
import { AuthShell } from "@/components/frame/AuthShell";
import { formatDateTime } from "@/lib/time";
import { pendingEnrolment, viewInvitation } from "@/services/identity/identity";
import { deps } from "@/server/runtime";
import { AuthenticatorStep, PasswordStep } from "./forms";

// The site-wide Referrer-Policy (same-origin) keeps the token in this address from reaching any
// other site. A stricter per-page policy would outlive the page in the app's client navigation
// and make the browser withhold the Origin of later form posts.
export const metadata: Metadata = { title: "Accept your invitation" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await deps();
  const invitation = d ? await viewInvitation(d, token) : null;
  if (!d || !invitation) {
    return (
      <AuthShell title="This invitation is not valid">
        <p className="text-ui font-normal text-ink-2">
          It may have been used already, withdrawn, or it expired 72 hours after it was issued. Ask the administrator who invited you to send a new one.
        </p>
      </AuthShell>
    );
  }

  const enrolment = invitation.passwordSet ? await pendingEnrolment(d, token) : null;
  if (enrolment) {
    const qr = await QRCode.toDataURL(enrolment.uri, { margin: 1, width: 176, errorCorrectionLevel: "M", color: { dark: "#141A24", light: "#FFFFFF" } });
    const grouped = enrolment.secret.match(/.{1,4}/g)!.join(" ");
    return (
      <AuthShell title="Set up your authenticator" lede="Step 2 of 2. An authenticator app is required for every account.">
        <ol className="grid gap-5 text-ui font-normal text-ink">
          <li>
            <p className="font-semibold">1. Scan this code with an authenticator app</p>
            <p className="mt-1 text-ink-2">For example Microsoft Authenticator, Google Authenticator, 1Password or Bitwarden.</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise */}
            <img src={qr} width={176} height={176} alt="QR code for your authenticator app" className="mt-3 border border-rule" />
            <p className="mt-3 text-meta text-ink-2">Cannot scan? Enter this key instead:</p>
            <p className="tnum mt-1 text-ui font-semibold tracking-wide break-all text-ink select-all">{grouped}</p>
          </li>
          <li>
            <p className="font-semibold">2. Enter the code the app shows</p>
            <div className="mt-3">
              <AuthenticatorStep token={token} />
            </div>
          </li>
        </ol>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Welcome, ${invitation.name}`}
      lede={
        <>
          You have been invited to Aletheia Government Operations as <span className="font-semibold text-ink">{invitation.email}</span>. Step 1 of 2. This invitation expires on{" "}
          {formatDateTime(new Date(invitation.expiresAt))}.
        </>
      }
    >
      <PasswordStep token={token} email={invitation.email} name={invitation.name} />
    </AuthShell>
  );
}
