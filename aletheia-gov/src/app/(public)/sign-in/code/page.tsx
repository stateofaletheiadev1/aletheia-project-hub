import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/brand/Contours";
import { Mark } from "@/components/brand/Mark";
import { SignInCodeForm } from "@/features/auth/TwoStepForms";

export const metadata: Metadata = {
  title: "Authenticator code",
  description: "The second step of signing in to the Government Workbench.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default function SignInCodePage() {
  return (
    <section className="sea relative flex min-h-[88vh] items-center overflow-hidden">
      <Contours variant="b" opacity={0.07} eager />
      <div className="shell relative grid-12 gap-y-12 pb-24 pt-[calc(var(--header-h)+5rem)]">
        <div className="col-span-12 md:col-span-6 lg:col-span-5">
          <Mark size={40} />
          <h1 id="page-title" tabIndex={-1} className="t-h1 mt-10 text-parchment-50 outline-none">
            Authenticator code
          </h1>
          <p className="t-lede mt-5 text-parchment-300">
            You turned on two-step sign-in for this account. Open your authenticator app and enter the code shown for the Aletheia Government Workbench. It changes every 30 seconds.
          </p>
          <div className="mt-10">
            <SignInCodeForm />
          </div>
          <p className="mt-8 text-[0.9375rem] text-parchment-300">
            <Link href="/sign-in" className="text-gold-300 underline underline-offset-4">
              Start again
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
