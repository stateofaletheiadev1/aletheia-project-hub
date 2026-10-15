import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ActionForm } from "@/components/patterns/ActionForm";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/form";
import { pendingTwoStep } from "@/services/identity/identity";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";
import { confirmTwoStepAction } from "../actions";

// Setting up two-step sign-in from the account (ADR 0007).

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default async function TwoStepPage() {
  const signedIn = await requireOfficial();
  const pending = pendingTwoStep(await requireDeps(), signedIn);
  if (!pending) redirect("/account#two-step");
  const qr = await QRCode.toDataURL(pending.uri, { margin: 1, width: 176, errorCorrectionLevel: "M", color: { dark: "#141A24", light: "#FFFFFF" } });
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <Link href="/account#two-step" className="text-meta font-semibold text-authority hover:underline">
        ← Your account
      </Link>
      <PageHeader overline={<SectionMark n="A1">Account</SectionMark>} title="Set up two-step sign-in" lede="Two steps, about a minute. After this, every sign-in asks for your password and a code." />
      <ol className="grid gap-8 text-ui font-normal text-ink">
        <li>
          <p className="font-semibold">1. Scan this code with an authenticator app on your phone</p>
          <p className="mt-1 text-ink-2">For example Microsoft Authenticator, Google Authenticator, 1Password or Bitwarden.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise */}
          <img src={qr} width={176} height={176} alt="QR code for your authenticator app" className="mt-3 border border-rule" />
          <p className="mt-3 text-meta text-ink-2">Cannot scan? Enter this key instead:</p>
          <p className="tnum mt-1 text-ui font-semibold tracking-wide break-all text-ink select-all">{pending.secret.match(/.{1,4}/g)!.join(" ")}</p>
        </li>
        <li>
          <p className="font-semibold">2. Enter the code the app shows</p>
          <ActionForm action={confirmTwoStepAction} submit="Turn on two-step sign-in" variant="primary" className="mt-3 max-w-sm">
            <Field id="code" label="Six-digit code">
              <TextInput id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="tnum tracking-widest" />
            </Field>
          </ActionForm>
        </li>
      </ol>
    </div>
  );
}
