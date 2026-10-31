import type { Metadata } from "next";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { Photo } from "@/components/media/Photo";
import { StatusSeal } from "@/components/records/StatusSeal";
import type { InstitutionalStatus } from "@/lib/status";

export const metadata: Metadata = {
  title: "Development framework",
  description: "The long-term development framework of Aletheia: what is designed now, what waits for a place, and how sites are studied.",
};

const AREAS: { name: string; status: InstitutionalStatus; text: string }[] = [
  { name: "Digital infrastructure", status: "in_development", text: "AletheiaChain, AletheiaDB and this platform. Built now, because they need no place." },
  { name: "Institutions and law", status: "in_development", text: "The founding framework and the institutions it creates, drafted and published as versioned documents." },
  { name: "Monetary and fiscal rules", status: "planned", text: "Issuance rules for the Aletheian Guilder and standards for Treasury reporting." },
  { name: "Energy and water", status: "proposed", text: "A framework for clean generation and desalination, prepared as technical and legal drafts." },
  { name: "Maritime administration", status: "proposed", text: "Ship registry, port governance and fisheries rules, prepared as drafts." },
  { name: "The capital, Antioch", status: "proposed", text: "An urban plan for the proposed capital. Drawings are conceptual visualizations, not existing sites." },
];

export default function DevelopmentPage() {
  return (
    <>
      <PageHead
        mark={{ n: "G7", label: "Development" }}
        title="The development framework"
        lede="What can be built before there is a place, what must wait for one, and how the difference is kept honest."
        image="site-engineers"
        imageCaption="Illustrative photograph, not an Aletheian site"
        contour="b"
      />

      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Territory", value: "None held or claimed" },
                { label: "Site studies", value: "Published as conceptual work only" },
                { label: "Imagery", value: "Every render is captioned as a conceptual visualization" },
              ]}
            />
          }
        >
          <article className="prose-ledger">
            <p className="t-lede text-ink-900">
              Development in Aletheia runs in two tracks. One builds what needs no territory: institutions, law, digital infrastructure and economic rules. The other prepares, on paper only, what does.
            </p>
            <p>
              The second track produces studies, drafts and plans. None of it implies that a site has been chosen, acquired or recognised. When a drawing of a proposed place appears on this site, it carries the caption “Conceptual visualization, not an existing site”.
            </p>
            <h2>Areas of work</h2>
          </article>

          <ul className="mt-8 border-t-2 border-navy-800">
            {AREAS.map((a) => (
              <li key={a.name} data-reveal-on className="grid gap-3 border-b rule py-7 md:grid-cols-[1fr_auto] md:gap-8">
                <div>
                  <p className="text-[1.25rem] font-medium">{a.name}</p>
                  <p className="mt-2 max-w-[56ch] text-[0.9375rem] leading-relaxed text-ink-600">{a.text}</p>
                </div>
                <StatusSeal status={a.status} />
              </li>
            ))}
          </ul>

          <div className="mt-14">
            <ArrowLink href="/founding-programme">The founding programme</ArrowLink>
          </div>
        </Folio>
      </div>

      <section aria-labelledby="window" className="sea relative overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <Photo name="offshore-wind" sizes="(min-width: 1024px) 50vw, 100vw" parallax={0.05} className="aspect-[4/3] lg:aspect-auto lg:min-h-[36rem]" caption="Illustrative photograph" />
          <div className="flex items-center px-[var(--gutter)] py-20 lg:px-16">
            <div>
              <SectionMark n="G8" label="Prepared, not promised" tone="sea" />
              <h2 id="window" className="t-h1 mt-8 text-parchment-50">
                Plans are published as plans.
              </h2>
              <p className="mt-6 max-w-[44ch] text-[1.0625rem] leading-relaxed text-parchment-300">
                A framework for energy or ports is useful long before it can be built. It is published here as a draft with its status, and it says what it is.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
