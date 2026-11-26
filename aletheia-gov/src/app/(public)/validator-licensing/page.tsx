import type { Metadata } from "next";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";

export const metadata: Metadata = {
  title: "Validator licensing",
  description:
    "Run a licensed validator of AletheiaChain: what an operator does and earns, what the node needs, and how an application becomes a place in the validator set.",
  alternates: { canonical: "/validator-licensing" },
};

const STEPS = [
  [
    "Apply",
    "Fill in the validator licence application: your details, the account that will operate the validator, and the server that will run it. Your application reference (AGV-EOI-…) identifies you for the rest of the process.",
  ],
  [
    "Agree the licence",
    "The application is reviewed, and the licence terms and fee are agreed in writing before admission. Nothing is charged on the chain.",
  ],
  [
    "Prepare the node",
    <>
      Run <code className="t-ref whitespace-nowrap">aletheiad</code> with the signer daemon on your own server. Its consensus and node keys are made on that server and never leave it. Until it is admitted, the
      node follows the chain without signing.
    </>,
  ],
  [
    "Register on the chain",
    <>
      Register the node from your operator account with <code className="t-ref whitespace-nowrap">aletheia-cli validator register</code>, giving its public keys, your application reference
      (<code className="t-ref whitespace-nowrap">--licence</code>) and the bond. Only a fingerprint of the reference goes on the chain. The bond is locked, not spent.
    </>,
  ],
  [
    "Admission by the Council",
    "The Governance Council matches the registration to the licence and admits it. The node becomes a validator at the next epoch, without any restart of the network.",
  ],
  [
    "Validate and earn",
    "Your validator signs blocks with the others and earns its share of the daily rewards. You may leave at any time; the bond returns when your exit takes effect.",
  ],
] as const satisfies readonly (readonly [string, React.ReactNode])[];

const TERMS = [
  ["Rewards", "A share of every transaction fee and of the validator reward pool, paid daily to your operator account."],
  ["How rewards are split", "By work: the blocks your validator served in the period, less the signatures it missed. A validator that is offline earns less."],
  ["Bond", "At least 10,000 ALnT, locked on the chain while you operate and returned when you leave. It is held, never spent."],
  ["Suspension", "The Council may suspend a validator at once, for cause; a suspended validator keeps its bond and may be reinstated."],
  ["Server", "A dedicated server with at least 4 virtual CPUs, 8 to 16 GB of memory and 200 GB of fast SSD storage, online around the clock."],
  ["Keys", "Held by the signer daemon on your server. Only public keys are ever shared, and no personal data is written to the chain."],
] as const;

export default function ValidatorLicensingPage() {
  return (
    <>
      <PageHead
        mark={{ n: "P5", label: "Take part" }}
        title="Validator licensing"
        lede="AletheiaChain is finalised by its validators. Licensed operators run validators beside the State's own, and are paid for the work they do."
        image="site-engineers"
      />

      <section aria-labelledby="terms" className="ledger chapter">
        <div className="shell">
          <SectionMark n="01" label="What an operator does and earns" />
          <h2 id="terms" className="sr-only">
            What an operator does and earns
          </h2>
          <dl className="mt-12 border-t rule">
            {TERMS.map(([term, text], i) => (
              <div
                key={term}
                data-reveal-on
                style={{ "--stagger": i } as React.CSSProperties}
                className="grid gap-3 border-b rule py-7 md:grid-cols-[14rem_1fr] md:gap-6"
              >
                <dt className="text-[1.125rem] font-semibold">{term}</dt>
                <dd className="text-[0.9844rem] leading-relaxed text-ink-600">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="steps" className="ledger chapter">
        <div className="shell">
          <SectionMark n="02" label="From application to validator" />
          <h2 id="steps" className="sr-only">
            From application to validator
          </h2>
          <ol className="mt-12 border-t rule">
            {STEPS.map(([title, text], i) => (
              <li
                key={title}
                data-reveal-on
                style={{ "--stagger": i } as React.CSSProperties}
                className="grid gap-3 border-b rule py-7 md:grid-cols-[3rem_14rem_1fr] md:gap-6"
              >
                <span className="t-ref text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[1.125rem] font-semibold">{title}</span>
                <span className="text-[0.9844rem] leading-relaxed text-ink-600">{text}</span>
              </li>
            ))}
          </ol>
          <p className="t-body mt-10 max-w-[62ch] text-ink-600">
            Applications are taken only through this site. The details you give are encrypted before they are stored and never written to the chain.
          </p>
          <div className="mt-10">
            <ArrowLink href="/validator-licensing/apply">Apply for a validator licence</ArrowLink>
          </div>
        </div>
      </section>
    </>
  );
}
