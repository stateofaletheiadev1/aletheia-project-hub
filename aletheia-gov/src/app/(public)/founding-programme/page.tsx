import type { Metadata } from "next";
import { Contours } from "@/components/brand/Contours";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { StatusSeal } from "@/components/records/StatusSeal";
import { phases } from "@/content/founding";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "The founding programme",
  description: "The five phases of the founding programme of Aletheia, the principle behind them, and where the work stands now.",
};

export default function FoundingProgrammePage() {
  return (
    <>
      <PageHead
        mark={{ n: "G6", label: "Founding programme" }}
        title="The founding programme"
        lede="Five phases, in order. The first two are under way. None of them depends on territory, and the last is pursued only by lawful means."
        image="drawings"
      />

      <section aria-labelledby="principle" className="ledger chapter">
        <div className="shell grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-3">
            <SectionMark n="01" label="The principle" />
          </div>
          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            <h2 id="principle" className="text-[clamp(1.75rem,3.4vw,3.25rem)] font-light leading-[1.14] tracking-[-0.025em] [text-wrap:balance]">
              {site.principle.replace(" before the physical state.", "")} <span className="text-gold-700">before the physical state.</span>
            </h2>
            <p className="t-body mt-8 text-ink-600">
              A state is, in large part, a set of institutions, records and rules that people trust. All of that can be designed, built and tested before there is a place to govern. Doing it first means that whatever comes later inherits institutions that already keep a public record and already answer for it.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="phases" className="sea chapter relative overflow-hidden">
        <Contours variant="b" opacity={0.06} parallax={0.05} />
        <div className="shell relative">
          <SectionMark n="02" label="The phases" tone="sea" />
          <h2 id="phases" className="t-display mt-8 text-parchment-50">
            Charter, infrastructure, people, economy, place.
          </h2>

          <ol className="relative mt-20">
            <span aria-hidden className="absolute bottom-0 left-[1.6rem] top-0 w-px bg-[var(--rule-sea)] md:left-[3.25rem]" />
            {phases.map((ph, i) => (
              <li key={ph.numeral} data-reveal-on style={{ "--stagger": i } as React.CSSProperties} className="relative grid grid-cols-[3.25rem_1fr] gap-x-5 pb-16 last:pb-0 md:grid-cols-[6.5rem_1fr_1fr] md:gap-x-10">
                <span
                  aria-hidden
                  className={`relative z-10 mt-1 flex h-[3.25rem] w-[3.25rem] items-center justify-center border text-[1.125rem] font-light md:ml-[1.625rem] ${
                    ph.status === "in_development" ? "border-gold-500 bg-navy-950 text-gold-300" : "border-[var(--rule-sea)] bg-navy-950 text-parchment-300"
                  }`}
                >
                  {ph.numeral}
                </span>
                <div>
                  <p className="t-meta text-[0.6875rem] text-parchment-400">Phase {ph.numeral}</p>
                  <h3 className="mt-2 text-[clamp(1.75rem,3vw,2.75rem)] font-light leading-none tracking-[-0.02em] text-parchment-50">{ph.name}</h3>
                  <div className="mt-4">
                    <StatusSeal status={ph.status} tone="sea" />
                  </div>
                </div>
                <div className="col-start-2 mt-6 md:col-start-3 md:mt-0">
                  <p className="text-[1.125rem] leading-relaxed text-parchment-100">{ph.aim}</p>
                  <ul className="mt-5 space-y-2 border-t rule pt-5">
                    {ph.work.map((w) => (
                      <li key={w} className="flex gap-3 text-[0.9375rem] text-parchment-300">
                        <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-gold-500" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="now" className="ledger chapter">
        <div className="shell grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-3">
            <SectionMark n="03" label="Current focus" />
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-5">
            <h2 id="now" className="t-h1">
              Where the work stands.
            </h2>
            <div className="prose-ledger mt-8">
              <p>
                Phases I and II are in development. The founding framework exists as a draft, the National Blueprint, and is being turned into versioned documents for this record. The AletheiaChain node software and AletheiaDB are being written. This platform is the first public part of phase II.
              </p>
              <p>
                Phases III and IV are planned and have not started. Phase V is proposed. No date has been set for any phase to finish, and none will be published until it is decided.
              </p>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              <ArrowLink href="/projects">The programmes</ArrowLink>
              <ArrowLink href="/development">The development framework</ArrowLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
