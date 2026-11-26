import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { ValidatorForm } from "@/features/validator/ValidatorForm";
import { interestConfigured } from "@/server/services/interest";

export const metadata: Metadata = {
  title: "Apply for a validator licence",
  description: "Apply to run a licensed validator of AletheiaChain: your details, your operator account and the server that will run the node.",
  alternates: { canonical: "/validator-licensing/apply" },
};

export default function ValidatorApplicationPage() {
  const open = interestConfigured();
  return (
    <>
      <PageHead
        mark={{ n: "P5", label: "Validator licensing" }}
        title="Apply for a validator licence"
        lede="Tell the government who you are, which account will operate the validator, and the server that will run it. You receive a reference for the rest of the process."
        image="site-engineers"
      />
      <section aria-labelledby="apply-heading" className="ledger-pale chapter">
        <div className="shell grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-4">
            <SectionMark n="01" label="The application" />
            <h2 id="apply-heading" className="t-h1 mt-8">
              Run a validator of AletheiaChain.
            </h2>
            <p className="mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed text-ink-600">
              The founding team reviews each application. The licence terms and fee are agreed in writing before admission; the node&apos;s keys are given later, on the chain, when
              you register it.
            </p>
            <p className="mt-6 max-w-[40ch] text-[0.875rem] leading-relaxed text-ink-500">
              Your details are encrypted before they are stored and are never written to the chain. Applying confers no licence or status.{" "}
              <Link className="link-ledger" href="/validator-licensing">
                How validator licensing works
              </Link>
              .
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            {open ? (
              <ValidatorForm />
            ) : (
              <div className="border-t-2 border-navy-800 pt-6">
                <p className="t-h3">Applications are not open yet.</p>
                <p className="mt-3 max-w-[52ch] text-[0.9375rem] text-ink-600">They open when the public record database is connected to this site.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
