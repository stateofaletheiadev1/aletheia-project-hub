import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { EmptyRecord } from "@/components/editorial/EmptyRecord";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { StatusSeal } from "@/components/records/StatusSeal";
import { getProgramme, programmes } from "@/content/programmes";
import { STATUS_META } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  return programmes.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const p = getProgramme((await props.params).slug);
  if (!p) return {};
  return { title: p.name, description: `${p.line} Status: ${STATUS_META[p.status].label}.` };
}

export default async function ProgrammePage(props: PageProps<"/projects/[slug]">) {
  const p = getProgramme((await props.params).slug);
  if (!p) notFound();

  return (
    <>
      <PageHead
        mark={{ n: "P2", label: "Programme" }}
        title={p.name}
        lede={p.line}
        image={p.image ?? undefined}
        imageCaption={p.illustrative ? "Illustrative photograph" : undefined}
      >
        <StatusSeal status={p.status} tone="sea" />
      </PageHead>

      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Status", value: <StatusSeal status={p.status} /> },
                { label: "Lead", value: p.lead },
                { label: "Progress", value: "Derived from published milestones only" },
                { label: "Scope", value: p.scope.join(" · ") },
              ]}
            />
          }
        >
          <article className="prose-ledger">
            {p.summary.map((para, i) => (
              <p key={i} className={i === 0 ? "t-lede text-ink-900" : undefined}>
                {para}
              </p>
            ))}
            <h2>Scope</h2>
            <ul>
              {p.scope.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </article>

          <section aria-labelledby="milestones" className="mt-16">
            <div className="flex items-baseline justify-between border-b-2 border-navy-800 pb-4">
              <h2 id="milestones" className="t-h3">
                Milestones
              </h2>
              <span className="t-ref text-ink-500">0 verified</span>
            </div>
            <EmptyRecord compact pattern="AGV-PRJ-····-····" title="No milestones have been published yet.">
              A milestone is published only when it is complete and its evidence is on the record. This programme shows no percentage of progress because none has been earned.
            </EmptyRecord>
          </section>

          <div className="mt-14 flex flex-wrap gap-x-10 gap-y-4">
            <ArrowLink href="/projects">All programmes</ArrowLink>
            {p.external ? (
              <ArrowLink href={p.external.href} external>
                {p.external.label}
              </ArrowLink>
            ) : null}
          </div>
        </Folio>
      </div>
    </>
  );
}
