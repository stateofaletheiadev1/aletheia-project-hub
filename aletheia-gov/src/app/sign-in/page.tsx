import type { Metadata } from "next";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Contours } from "@/components/brand/Contours";
import { Mark } from "@/components/brand/Mark";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the applicant portal or the government workbench.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <section className="sea relative flex min-h-[88vh] items-center overflow-hidden">
      <Contours variant="b" opacity={0.07} eager />
      <div className="shell relative grid-12 pb-24 pt-[calc(var(--header-h)+5rem)]">
        <div className="col-span-12 md:col-span-8 lg:col-span-5">
          <Mark size={40} />
          <h1 id="page-title" tabIndex={-1} className="t-h1 mt-10 text-parchment-50 outline-none">
            Sign in
          </h1>
          <p className="t-lede mt-6 text-parchment-300">Accounts are not open yet.</p>
          <p className="mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-parchment-300">
            The applicant portal opens with the first published founding role. The government workbench is for appointed officers and opens with the first appointments. Neither takes sign-ups before then.
          </p>
          <div className="mt-12 border-t rule pt-8">
            <ArrowLink href="/opportunities" tone="sea">
              Founding opportunities
            </ArrowLink>
          </div>
        </div>
      </div>
    </section>
  );
}
