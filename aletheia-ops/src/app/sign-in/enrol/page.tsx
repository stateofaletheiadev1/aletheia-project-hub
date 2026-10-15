import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AuthShell } from "@/components/frame/AuthShell";
import { signInEnrolment } from "@/services/identity/identity";
import { deps } from "@/server/runtime";
import { mfaToken } from "@/server/session";
import { CodeForm } from "../forms";

// Enrolment of an authenticator during sign-in, for an account created while codes were switched
// off (ADR 0007). Once codes are required again, nobody signs in without one.

export const metadata: Metadata = { title: "Set up your authenticator" };

export default async function EnrolPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const token = await mfaToken();
  const d = await deps();
  const enrolment = token && d ? await signInEnrolment(d, token) : null;
  if (!enrolment) redirect("/sign-in");
  const { next } = await searchParams;
  const qr = await QRCode.toDataURL(enrolment.uri, { margin: 1, width: 176, errorCorrectionLevel: "M", color: { dark: "#141A24", light: "#FFFFFF" } });
  return (
    <AuthShell
      title="Set up your authenticator"
      lede="Authenticator codes are now required for every account. Set one up once; from then on you sign in with your password and a code."
      footer={
        <Link href="/sign-in" className="underline underline-offset-4 hover:text-ink-inverse">
          Start again
        </Link>
      }
    >
      <ol className="grid gap-5 text-ui font-normal text-ink">
        <li>
          <p className="font-semibold">1. Scan this code with an authenticator app</p>
          <p className="mt-1 text-ink-2">For example Microsoft Authenticator, Google Authenticator, 1Password or Bitwarden.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise */}
          <img src={qr} width={176} height={176} alt="QR code for your authenticator app" className="mt-3 border border-rule" />
          <p className="mt-3 text-meta text-ink-2">Cannot scan? Enter this key instead:</p>
          <p className="tnum mt-1 text-ui font-semibold tracking-wide break-all text-ink select-all">{enrolment.secret.match(/.{1,4}/g)!.join(" ")}</p>
        </li>
        <li>
          <p className="font-semibold">2. Enter the code the app shows</p>
          <div className="mt-3">
            <CodeForm next={next ?? "/"} enrol />
          </div>
        </li>
      </ol>
    </AuthShell>
  );
}
