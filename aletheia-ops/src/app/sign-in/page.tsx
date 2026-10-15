import type { Metadata } from "next";
import { Arms } from "@/components/brand/Arms";
import { Contours } from "@/components/brand/Contours";

// The sign-in screen (brief §8: arms and contours belong here). Accounts are provisioned by
// invitation only. Until the identity phase is complete this page says so plainly rather than
// showing a form that cannot sign anyone in.

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-masthead px-4 py-12 text-ink-inverse on-navy">
      <Contours variant="a" tone="light" opacity={0.09} />
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Arms height={112} priority />
          <p className="caps mt-6 text-seal-on-navy">Sovereign Covenant State of Aletheia</p>
          <h1 className="mt-2 text-h1 text-ink-inverse">Government Operations</h1>
          <p className="mt-2 text-ui text-ink-inverse-2">The workbench behind the public record at aletheiagov.org</p>
        </div>
        <div className="mt-10 rounded-sm border border-rule-inverse bg-masthead/80 p-6">
          <h2 className="text-h3 text-ink-inverse">Accounts are not open yet</h2>
          <p className="mt-2 text-ui font-normal text-ink-inverse-2">
            Access is by invitation from an administrator, with a password and an authenticator app. Invitations are issued once the first administrators have been appointed.
          </p>
        </div>
        <p className="mt-8 text-center text-meta text-ink-inverse-2">Veritas in Foedere</p>
      </div>
    </main>
  );
}
