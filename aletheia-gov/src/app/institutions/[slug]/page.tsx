import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { StatusSeal } from "@/components/records/StatusSeal";
import { getInstitution, institutions } from "@/content/institutions";
import { programmes } from "@/content/programmes";
import { STATUS_META } from "@/lib/status";

export const dynamicParams = false;

export function generateStaticParams() {
  return institutions.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata(props: PageProps<"/institutions/[slug]">): Promise<Metadata> {
  const inst = getInstitution((await props.params).slug);
  if (!inst) return {};
  return { title: inst.name, description: `${inst.mandate} Status: ${STATUS_META[inst.status].label}.` };
}

export default async function InstitutionPage(props: PageProps<"/institutions/[slug]">) {
  const inst = getInstitution((await props.params).slug);
  if (!inst) notFound();

  const parent = inst.parent ? getInstitution(inst.parent) : undefined;
  const children = institutions.filter((i) => i.parent === inst.slug);
  const related = programmes.filter((p) => p.lead.startsWith(inst.name));

  return (
    <>
      <PageHead mark={{ n: "G4", label: inst.kind }} title={inst.name} lede={inst.mandate} contour="a">
        <StatusSeal status={inst.status} tone="sea" />
      </PageHead>

      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Status", value: <StatusSeal status={inst.status} /> },
                { label: "Kind", value: inst.kind },
                ...(parent ? [{ label: "Part of", value: <Link className="link-ledger" href={`/institutions/${parent.slug}`}>{parent.name}</Link> }] : []),
                { label: "Basis", value: inst.basis },
                { label: "Leadership", value: "No published appointments" },
                { label: "Public contact", value: "None approved yet" },
              ]}
            />
          }
        >
          <article className="prose-ledger">
            {inst.summary.map((p, i) => (
              <p key={i} className={i === 0 ? "t-lede text-ink-900" : undefined}>
                {p}
              </p>
            ))}

            {inst.responsibilities.length ? (
              <>
                <h2>Proposed responsibilities</h2>
                <ul>
                  {inst.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <h2>What its status means</h2>
            <p>
              <strong className="font-semibold">{STATUS_META[inst.status].label}.</strong> {STATUS_META[inst.status].meaning}{" "}
              {inst.status === "proposed"
                ? "It has no staff, budget or powers. It will be marked in formation only when people and work are assigned to it."
                : null}
            </p>
          </article>

          {children.length ? (
            <section aria-labelledby="within" className="mt-16">
              <h2 id="within" className="t-h3">
                Within this institution
              </h2>
              <ul className="mt-6 border-t rule">
                {children.map((c) => (
                  <li key={c.slug} className="border-b rule">
                    <Link href={`/institutions/${c.slug}`} className="group flex items-baseline justify-between gap-6 py-4">
                      <span className="draw-link text-[1.0625rem]">{c.name}</span>
                      <StatusSeal status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {related.length ? (
            <section aria-labelledby="programmes" className="mt-16">
              <h2 id="programmes" className="t-h3">
                Programmes it leads
              </h2>
              <ul className="mt-6 border-t rule">
                {related.map((p) => (
                  <li key={p.slug} className="border-b rule">
                    <Link href={`/projects/${p.slug}`} className="group flex items-baseline justify-between gap-6 py-4">
                      <span className="draw-link text-[1.0625rem]">{p.name}</span>
                      <StatusSeal status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="history" className="mt-16">
            <h2 id="history" className="t-h3">
              Change history
            </h2>
            <p className="mt-4 border-t rule pt-4 text-[0.9375rem] text-ink-600">
              No status changes have been recorded. Each future change will be listed here with its date, the officers who approved it and the evidence cited.
            </p>
          </section>

          <div className="mt-14">
            <ArrowLink href="/institutions">The full institutional framework</ArrowLink>
          </div>
        </Folio>
      </div>
    </>
  );
}
