import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/brand/Contours";
import { PageHead } from "@/components/editorial/PageHead";
import { Photo } from "@/components/media/Photo";
import { StatusSeal } from "@/components/records/StatusSeal";
import { programmes } from "@/content/programmes";

export const metadata: Metadata = {
  title: "Programmes",
  description: "The national programmes of the founding government of Aletheia, each with its real status and its published milestones.",
};

export default function ProgrammesPage() {
  return (
    <>
      <PageHead
        mark={{ n: "P2", label: "Programmes" }}
        title="National programmes"
        lede="The work of building Aletheia, programme by programme. Progress is shown only from verified, published milestones."
        image="surf-aerial"
      />
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <ol className="shell">
          {programmes.map((p, i) => (
            <li key={p.slug} data-reveal-on className="border-t rule first:border-t-2 first:border-navy-800">
              <Link href={`/projects/${p.slug}`} className="group grid-12 gap-y-6 py-10 md:py-12">
                <div className="col-span-12 md:col-span-4 lg:col-span-3">
                  <div className="relative aspect-[4/3] overflow-hidden bg-navy-950">
                    {p.image ? (
                      <Photo
                        name={p.image}
                        alt={p.imageAlt}
                        sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 100vw"
                        className="absolute inset-0"
                        imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-tide)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="sea absolute inset-0 flex items-end p-5">
                        <Contours variant={i % 2 ? "b" : "a"} tone="gold" opacity={0.35} />
                        <span className="relative text-[1.375rem] font-light leading-tight text-parchment-50">{p.name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-12 md:col-span-8 lg:col-span-5 lg:col-start-5">
                  <p className="t-ref text-gold-700">{String(i + 1).padStart(2, "0")}</p>
                  <h2 className="mt-3 text-[clamp(1.5rem,2.4vw,2.25rem)] font-light leading-tight tracking-[-0.02em] group-hover:text-navy-600">
                    {p.name}
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-relaxed text-ink-600">{p.line}</p>
                </div>
                <dl className="col-span-12 grid grid-cols-2 gap-6 text-[0.875rem] md:col-span-8 md:col-start-5 lg:col-span-3 lg:col-start-10 lg:grid-cols-1 lg:gap-5">
                  <div>
                    <dt className="t-meta text-[0.6875rem] text-ink-500">Status</dt>
                    <dd className="mt-2">
                      <StatusSeal status={p.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="t-meta text-[0.6875rem] text-ink-500">Lead</dt>
                    <dd className="mt-1.5 text-ink-700">{p.lead}</dd>
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <dt className="t-meta text-[0.6875rem] text-ink-500">Milestones</dt>
                    <dd className="mt-1.5 text-ink-600">None published yet</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
