import type { Metadata } from "next";
import Link from "next/link";
import { FoundingNotice } from "@/components/editorial/FoundingNotice";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { StatusSeal } from "@/components/records/StatusSeal";
import { institutions, ministries, type Institution } from "@/content/institutions";

export const metadata: Metadata = {
  title: "Institutional framework",
  description:
    "The institutions of the Sovereign Covenant State of Aletheia as designed in the draft framework, each with its mandate and current status.",
};

const GROUPS: { title: string; kinds: Institution["kind"][]; note: string }[] = [
  { title: "The founding body", kinds: ["Founding body"], note: "The body building the State now." },
  { title: "Legislature and review", kinds: ["Legislature", "Territorial chamber"], note: "Where law is to be made and reviewed." },
  { title: "Executive and judiciary", kinds: ["Executive", "Judiciary"], note: "Where law is to be carried out and tested." },
  { title: "Independent bodies", kinds: ["Independent body"], note: "Bodies that check the others, and hold money apart from budget." },
];

function Row({ inst, index }: { inst: Institution; index: number }) {
  return (
    <li className="border-b rule">
      <Link
        href={`/institutions/${inst.slug}`}
        className="group grid grid-cols-12 items-baseline gap-x-4 gap-y-2 py-7 transition-colors duration-[var(--dur-base)] hover:bg-parchment-50"
      >
        <span className="t-ref col-span-2 text-gold-700 md:col-span-1 md:pl-3">{String(index).padStart(2, "0")}</span>
        <span className="col-span-10 text-[clamp(1.25rem,1.8vw,1.75rem)] font-light leading-tight tracking-[-0.015em] transition-transform duration-[var(--dur-base)] ease-[var(--ease-tide)] group-hover:translate-x-1.5 md:col-span-5">
          {inst.name}
        </span>
        <span className="col-span-10 col-start-3 text-[0.9375rem] leading-relaxed text-ink-600 md:col-span-4 md:col-start-auto">{inst.mandate}</span>
        <span className="col-span-10 col-start-3 md:col-span-2 md:col-start-auto md:justify-self-end md:pr-3">
          <StatusSeal status={inst.status} />
        </span>
      </Link>
    </li>
  );
}

export default function InstitutionsPage() {
  let n = 0;
  return (
    <>
      <PageHead
        mark={{ n: "G4", label: "Institutions" }}
        title="The institutional framework"
        lede="Every institution of the State, described before anyone holds office in it. Each is shown with its mandate and its real status."
        image="civic-architecture"
        imageCaption="Illustrative photograph"
        contour="c"
      />
      <FoundingNotice variant="banner" />

      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <div className="shell">
          {GROUPS.map((g) => {
            const items = institutions.filter((i) => !i.parent && g.kinds.includes(i.kind));
            return (
              <section key={g.title} aria-labelledby={`g-${g.title}`} className="grid-12 mb-24 gap-y-8 last:mb-0">
                <div className="col-span-12 lg:col-span-3">
                  <h2 id={`g-${g.title}`} className="t-meta text-gold-700">
                    {g.title}
                  </h2>
                  <p className="mt-3 max-w-[30ch] text-[0.9375rem] text-ink-600">{g.note}</p>
                </div>
                <ul className="col-span-12 border-t-2 border-navy-800 lg:col-span-9">
                  {items.map((inst) => (
                    <Row key={inst.slug} inst={inst} index={++n} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="ministries" className="sea chapter">
        <div className="shell">
          <div className="grid-12 items-end gap-y-8">
            <div className="col-span-12 lg:col-span-7">
              <SectionMark n="G5" label="The cabinet" tone="sea" />
              <h2 id="ministries" className="t-display mt-8 text-parchment-50">
                Nine ministries, and no more.
              </h2>
            </div>
            <p className="col-span-12 max-w-[42ch] text-[1.0625rem] leading-relaxed text-parchment-300 lg:col-span-4 lg:col-start-9">
              The draft constitution caps the executive at nine ministries. Adding a tenth would require amending the constitution.
            </p>
          </div>
          <ol className="mt-20 grid gap-x-12 border-t rule sm:grid-cols-2 lg:grid-cols-3">
            {ministries.map((m, i) => (
              <li key={m.slug} data-reveal-on style={{ "--stagger": i % 3 } as React.CSSProperties} className="border-b rule">
                <Link href={`/institutions/${m.slug}`} className="group block py-9">
                  <span className="flex items-baseline justify-between">
                    <span className="t-ref text-gold-400">M{String(i + 1).padStart(2, "0")}</span>
                    <StatusSeal status={m.status} tone="sea" />
                  </span>
                  <span className="t-meta mt-6 block text-[0.6875rem] text-parchment-400">Ministry of</span>
                  <span className="mt-2 block text-[1.5rem] font-light leading-snug tracking-[-0.015em] text-parchment-50 transition-transform duration-[var(--dur-base)] ease-[var(--ease-tide)] group-hover:translate-x-1.5">
                    {m.name.replace("Ministry of ", "")}
                  </span>
                  <span className="mt-3 block text-[0.9375rem] leading-relaxed text-parchment-300">{m.mandate}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
