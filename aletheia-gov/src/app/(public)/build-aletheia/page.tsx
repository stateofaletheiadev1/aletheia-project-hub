import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/brand/Contours";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { InterestSection } from "@/features/interest/InterestSection";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Build Aletheia",
  description: "Ways to contribute to Aletheia: founding roles and other positions, expertise, scrutiny of the public record.",
};

const WAYS = [
  {
    n: "01",
    title: "Take a founding role or another position",
    text: "Founding roles and permanent, fixed-term, advisory and volunteer positions are published with a reference, a mandate and selection criteria. Applications open with the first published position.",
    href: "/opportunities",
    cta: "Opportunities",
  },
  {
    n: "02",
    title: "Read the record, and question it",
    text: "Every decision, document and payment is published with a reference. Scrutiny is a contribution: the record is built to be checked.",
    href: "/documents",
    cta: "The public record",
  },
  {
    n: "03",
    title: "Follow the programmes",
    text: "Each programme shows its status and its verified milestones. Follow the work where it is actually happening.",
    href: "/projects",
    cta: "The programmes",
  },
  {
    n: "04",
    title: "Learn what Aletheia is",
    text: "The national website sets out the State’s identity, constitutional vision and currency.",
    href: site.nationalSite,
    cta: "stateofaletheia.org",
    external: true,
  },
];

export default function BuildAletheiaPage() {
  return (
    <>
      <PageHead
        mark={{ n: "P3", label: "Take part" }}
        title="Build Aletheia"
        lede="The State is being built by people who choose to. Here is how to take part, and what you can expect in return: a published process and a public record."
        image="evening-sea"
      />

      <section aria-labelledby="ways" className="ledger chapter">
        <div className="shell">
          <SectionMark n="01" label="Ways to contribute" />
          <h2 id="ways" className="sr-only">
            Ways to contribute
          </h2>
          <ol className="mt-12 grid gap-x-12 md:grid-cols-2">
            {WAYS.map((w, i) => {
              const inner = (
                <>
                  <span className="t-ref text-gold-700">{w.n}</span>
                  <span className="mt-5 block text-[clamp(1.75rem,2.6vw,2.5rem)] font-light leading-[1.1] tracking-[-0.02em]">{w.title}</span>
                  <span className="mt-5 block max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-600">{w.text}</span>
                  <span className="mt-8 inline-flex items-center gap-3 text-[1rem] font-semibold text-navy-800">
                    <span className="draw-link">{w.cta}</span>
                    <span aria-hidden className="arrow-nudge">
                      {w.external ? "↗" : "→"}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={w.n} data-reveal-on style={{ "--stagger": i % 2 } as React.CSSProperties} className="border-t-2 border-navy-800">
                  {w.external ? (
                    <a href={w.href} rel="noopener" className="group block py-10">
                      {inner}
                    </a>
                  ) : (
                    <Link href={w.href} className="group block py-10">
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <InterestSection mark="02" />

      <section aria-labelledby="expect" className="sea chapter relative overflow-hidden">
        <Contours variant="c" tone="gold" opacity={0.14} parallax={0.06} />
        <div className="shell relative grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-10 lg:col-start-2">
            <SectionMark n="03" label="What to expect" tone="sea" />
            <p id="expect" className="t-display mt-12 text-parchment-50">
              No promises of office, land or money. <span className="text-gold-400">A fair process, in public.</span>
            </p>
            <p className="mt-10 max-w-[56ch] text-[1.0625rem] leading-relaxed text-parchment-300">
              Every position states whether it is paid; founding and volunteer roles are unpaid unless the role states approved compensation. Holding a position confers no citizenship, residence or title.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
