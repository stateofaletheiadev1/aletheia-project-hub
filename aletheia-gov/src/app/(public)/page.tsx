import Link from "next/link";
import { Arms } from "@/components/brand/Arms";
import { Contours } from "@/components/brand/Contours";
import { EmptyRecord } from "@/components/editorial/EmptyRecord";
import { Rail } from "@/components/editorial/Rail";
import { SectionMark } from "@/components/editorial/SectionMark";
import { Photo } from "@/components/media/Photo";
import { StatusSeal } from "@/components/records/StatusSeal";
import { topLevelInstitutions } from "@/content/institutions";
import { featuredProgrammes } from "@/content/programmes";
import { formatDateLong, formatDateShort } from "@/lib/dates";
import { site } from "@/lib/site";
import { lastPublishedAt, listPublished } from "@/server/records/public-records";

const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;

export default async function HomePage() {
  const [last, opportunities, documents, decisions, dispatches, finance] = await Promise.all([
    lastPublishedAt(),
    listPublished("opportunity", { limit: 5 }),
    listPublished("document", { limit: 3 }),
    listPublished("decision", { limit: 3 }),
    listPublished("dispatch", { limit: 3 }),
    listPublished("finance", { limit: 3 }),
  ]);

  const record = [
    { title: "Documents", href: "/documents", pattern: "AGV-DOC-····-····", listing: documents, empty: "Founding documents will be published here, each with its version history and content hash." },
    { title: "Decisions", href: "/decisions", pattern: "AGV-DEC-····-····", listing: decisions, empty: "Decisions are published only once adopted and approved by a second officer." },
    { title: "Dispatches", href: "/dispatches", pattern: "AGV-DSP-····-····", listing: dispatches, empty: "Announcements and notices from the founding government." },
    { title: "Public finance", href: "/public-finance", pattern: "AGV-FIN-····-····", listing: finance, empty: "Budgets, receipts and expenditure, each traced to a source document." },
  ];

  return (
    <>
      {/* § 00 — Hero (Sea) */}
      <section aria-labelledby="page-title" className="sea relative h-[100svh] min-h-[640px] overflow-hidden">
        <div className="hero-settle absolute inset-0">
          <Photo name="sea-dusk" priority reveal={false} parallax={0.06} sizes="100vw" className="absolute inset-0" />
        </div>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--navy-950) 0%, color-mix(in oklab, var(--navy-950) 82%, transparent) 26%, color-mix(in oklab, var(--navy-950) 18%, transparent) 62%, color-mix(in oklab, var(--navy-950) 55%, transparent) 100%)",
          }}
        />
        <Contours variant="a" opacity={0.05} eager />

        <div className="shell relative flex h-full flex-col justify-end pb-[calc(4.25rem+clamp(2.5rem,7vh,5rem))]">
          <div className="grid-12 items-end">
            <div className="col-span-12 lg:col-span-10">
              <h1 id="page-title" tabIndex={-1} className="outline-none">
                <span className="mask-line t-meta text-gold-300" style={css({ "--i": 0 })}>
                  <span>The Government of</span>
                </span>
                <span className="mask-line t-display-xl mt-4 uppercase text-parchment-50 md:mt-5" style={css({ "--i": 1 })}>
                  <span>Aletheia</span>
                </span>
                <span className="mask-line t-lede mt-5 text-parchment-200 md:mt-7" style={css({ "--i": 2 })}>
                  <span>{site.officialName}</span>
                </span>
              </h1>
            </div>
            <div className="late-fade col-span-2 hidden justify-end lg:flex" style={css({ "--d": "700ms" })}>
              <Arms height={96} priority className="h-24 w-auto opacity-95" />
            </div>
          </div>
        </div>

        {/* The ledger strip */}
        <div className="late-fade ledger absolute inset-x-0 bottom-0" style={css({ "--d": "520ms" })}>
          <div className="shell flex h-[4.25rem] items-center justify-between gap-6 text-[0.8125rem]">
            <ul className="flex min-w-0 items-center gap-6 overflow-hidden whitespace-nowrap text-ink-700">
              <li className="font-semibold tracking-[0.04em] text-navy-800">{site.motto.latin}</li>
              <li aria-hidden className="h-4 w-px bg-[var(--rule-ledger)]" />
              <li className="hidden sm:block">Founding government-in-formation</li>
              <li aria-hidden className="hidden h-4 w-px bg-[var(--rule-ledger)] md:block" />
              <li className="hidden md:block">{last ? `Last publication ${formatDateLong(last)}` : "No records published yet"}</li>
            </ul>
            <a href="#founding" className="group flex shrink-0 items-center gap-2 font-semibold text-navy-800">
              <span className="draw-link">Read the founding record</span>
              <span aria-hidden className="arrow-nudge arrow-nudge-down">↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* § 01 — The founding government (Ledger) */}
      <section id="founding" aria-labelledby="s01" className="ledger chapter">
        <div className="shell grid-12 gap-y-12">
          <div className="col-span-12 lg:col-span-3">
            <SectionMark n="01" />
            <h2 id="s01" className="t-meta mt-3 text-ink-600">The founding government</h2>
            <dl className="mt-10 hidden space-y-6 border-t rule pt-6 lg:block">
              <div>
                <dt className="t-meta text-[0.6875rem] text-ink-500">Status</dt>
                <dd className="mt-2">
                  <StatusSeal status="in_formation" />
                </dd>
              </div>
              <div>
                <dt className="t-meta text-[0.6875rem] text-ink-500">Territory</dt>
                <dd className="mt-1.5 text-[0.9375rem]">None held or claimed</dd>
              </div>
              <div>
                <dt className="t-meta text-[0.6875rem] text-ink-500">Accountable through</dt>
                <dd className="mt-1.5 text-[0.9375rem]">The public record on this site</dd>
              </div>
            </dl>
          </div>

          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            <p data-reveal-on className="text-[clamp(1.75rem,3.4vw,3.25rem)] font-light leading-[1.14] tracking-[-0.025em] text-ink-900 [text-wrap:balance]">
              The founding government builds the institutions, infrastructure, economic frameworks and public record of Aletheia{" "}
              <span className="text-gold-700">before there is territory to govern.</span>
            </p>

            <ol className="mt-16 grid gap-10 border-t rule pt-10 md:grid-cols-3 md:gap-8">
              {[
                ["Design", "Institutions are written down first: what each may do, what it may not, and who checks it."],
                ["Build", "The systems those institutions will run on are built now: a ledger, a record database, this platform."],
                ["Publish", "Every decision, appointment and payment is published with a reference anyone can cite."],
              ].map(([title, text], i) => (
                <li key={title} data-reveal-on style={css({ "--stagger": i })}>
                  <p className="t-ref text-gold-700">{String(i + 1).padStart(2, "0")}</p>
                  <p className="t-h3 mt-3">{title}</p>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-14 flex items-center gap-4 lg:hidden">
              <StatusSeal status="in_formation" />
            </div>
            <Link href="/government" className="group mt-10 inline-flex items-center gap-3 text-[1rem] font-semibold text-navy-800">
              <span className="draw-link">How the founding government works</span>
              <span aria-hidden className="arrow-nudge">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* § 02 — Institutional framework (Sea) */}
      <section aria-labelledby="s02" className="sea chapter relative overflow-hidden">
        <Contours variant="b" opacity={0.07} parallax={0.06} />
        <div className="shell relative">
          <div className="grid-12 items-end gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <SectionMark n="02" label="Institutional framework" tone="sea" />
              <h2 id="s02" className="t-display mt-8 text-parchment-50">
                Designed in full,
                <br />
                staffed in the open.
              </h2>
            </div>
            <p className="col-span-12 max-w-[42ch] text-[1.0625rem] leading-relaxed text-parchment-300 lg:col-span-4">
              Every institution of the State is described before anyone holds office in it. Each carries its real status.
            </p>
          </div>

          <ul className="mt-20 border-b rule">
            {topLevelInstitutions.map((inst, i) => (
              <li key={inst.slug} data-reveal-on className="border-t rule" style={css({ "--stagger": Math.min(i, 6) })}>
                <Link
                  href={`/institutions/${inst.slug}`}
                  className="group relative grid grid-cols-12 items-baseline gap-x-4 gap-y-2 py-7 transition-colors duration-[var(--dur-base)] hover:bg-navy-900 md:py-9"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-gold-500 transition-transform duration-[var(--dur-base)] ease-[var(--ease-tide)] group-hover:scale-y-100" />
                  <span className="t-ref col-span-2 text-gold-400 md:col-span-1 md:pl-4">{String(i + 1).padStart(2, "0")}</span>
                  <span className="col-span-10 transition-transform duration-[var(--dur-base)] ease-[var(--ease-tide)] group-hover:translate-x-2 md:col-span-5">
                    <span className="block text-[clamp(1.375rem,2.2vw,2.125rem)] font-light leading-tight tracking-[-0.015em] text-parchment-50">
                      {inst.name}
                    </span>
                    <span className="t-meta mt-2 block text-[0.6875rem] text-parchment-400">{inst.kind}</span>
                  </span>
                  <span className="col-span-10 col-start-3 text-[0.9375rem] leading-relaxed text-parchment-300 md:col-span-4 md:col-start-auto">
                    {inst.mandate}
                  </span>
                  <span className="col-span-10 col-start-3 mt-2 md:col-span-2 md:col-start-auto md:mt-0 md:justify-self-end md:pr-4">
                    <StatusSeal status={inst.status} tone="sea" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Link href="/institutions" className="group mt-12 inline-flex items-center gap-3 text-[1rem] font-semibold text-gold-300">
            <span className="draw-link">The full framework, including the nine ministries</span>
            <span aria-hidden className="arrow-nudge">→</span>
          </Link>
        </div>
      </section>

      {/* § 03 — National programmes (Ledger) */}
      <section aria-labelledby="s03" className="ledger chapter overflow-hidden">
        <div className="shell grid-12 items-end gap-y-8">
          <div className="col-span-12 lg:col-span-7">
            <SectionMark n="03" label="National programmes" />
            <h2 id="s03" className="t-display mt-8">The work under way.</h2>
          </div>
          <p className="col-span-12 max-w-[44ch] text-[1.0625rem] leading-relaxed text-ink-600 lg:col-span-4 lg:col-start-9">
            Progress is shown only from verified, published milestones. Where none exist yet, we say so.
          </p>
        </div>

        <div className="mt-14">
          <Rail label="Featured programmes" count={featuredProgrammes.length}>
            {featuredProgrammes.map((p, i) => (
              <li key={p.slug} className="relative w-[82vw] shrink-0 snap-start sm:w-[25rem] lg:w-[27rem]">
                <Link href={`/projects/${p.slug}`} className="group block">
                  <div className="relative overflow-hidden bg-navy-900">
                    {p.image ? (
                      <Photo
                        name={p.image}
                        alt={p.imageAlt}
                        sizes="(min-width: 1024px) 27rem, (min-width: 640px) 25rem, 82vw"
                        className="aspect-[4/5]"
                        imgClassName="transition-transform duration-[1400ms] ease-[var(--ease-tide)] group-hover:scale-[1.035]"
                      />
                    ) : null}
                    <span className="t-ref absolute left-4 top-4 bg-parchment-50 px-2 py-1 text-[0.6875rem] text-navy-800">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-4">
                    <StatusSeal status={p.status} />
                  </div>
                  <p className="t-h3 mt-3 text-ink-900 transition-colors group-hover:text-navy-600">{p.name}</p>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">{p.line}</p>
                  <p className="mt-5 border-t rule pt-4 text-[0.8125rem] text-ink-500">
                    <span className="font-semibold text-ink-700">Latest verified milestone: </span>
                    No milestones published yet
                  </p>
                </Link>
              </li>
            ))}
          </Rail>
        </div>

        <div className="shell mt-14">
          <Link href="/projects" className="group inline-flex items-center gap-3 text-[1rem] font-semibold text-navy-800">
            <span className="draw-link">All programmes</span>
            <span aria-hidden className="arrow-nudge">→</span>
          </Link>
        </div>
      </section>

      {/* § 04 — Founding opportunities (Sea) */}
      <section aria-labelledby="s04" className="sea relative overflow-hidden">
        <div className="relative h-[42vh] min-h-[280px] overflow-hidden md:h-[56vh]">
          <Photo name="deep-water" sizes="100vw" parallax={0.07} className="absolute inset-0" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-navy-950" />
        </div>
        <div className="shell relative grid-12 gap-y-14 pb-[var(--chapter-space)] pt-10">
          <div className="col-span-12 lg:col-span-5">
            <SectionMark n="04" label="Founding opportunities" tone="sea" />
            <h2 id="s04" className="t-h1 mt-8 text-parchment-50">
              Aletheia is being built by people who choose to.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[1.0625rem] leading-relaxed text-parchment-300">
              Founding roles are published here with a reference, a mandate and the criteria for selection. Applications are reviewed by two people, and every appointment is published.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              <Link href="/opportunities" className="group inline-flex items-center gap-3 text-[1rem] font-semibold text-gold-300">
                <span className="draw-link">Founding opportunities</span>
                <span aria-hidden className="arrow-nudge">→</span>
              </Link>
              <Link href="/register-interest" className="group inline-flex items-center gap-3 text-[1rem] text-parchment-200">
                <span className="draw-link">Register your interest</span>
              </Link>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <div className="flex items-baseline justify-between border-b rule pb-4">
              <p className="t-meta text-[0.6875rem] text-parchment-400">Open roles</p>
              <p className="t-ref text-parchment-300">{opportunities.items.length} open</p>
            </div>
            {opportunities.items.length === 0 ? (
              <EmptyRecord tone="sea" pattern="AGV-OPP-····-····" title="No founding roles are open at this time.">
                When a role opens it will appear here with its reference, institution and closing date. Nothing is recruited outside this register.
              </EmptyRecord>
            ) : (
              <ul>
                {opportunities.items.map((o) => (
                  <li key={o.reference} className="border-b rule">
                    <Link href={`/opportunities/${o.slug}`} className="block py-5">
                      <span className="t-ref text-gold-400">{o.reference}</span>
                      <span className="mt-1 block text-[1.125rem] text-parchment-50">{o.title}</span>
                      {o.issuer ? <span className="text-[0.875rem] text-parchment-300">{o.issuer}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* § 05 — The public record (Ledger) */}
      <section aria-labelledby="s05" className="ledger chapter">
        <div className="shell">
          <div className="grid-12 items-end gap-y-8">
            <div className="col-span-12 lg:col-span-7">
              <SectionMark n="05" label="The public record" />
              <h2 id="s05" className="t-display mt-8">Nothing is real until it is published.</h2>
            </div>
            <p className="col-span-12 max-w-[44ch] text-[1.0625rem] leading-relaxed text-ink-600 lg:col-span-4 lg:col-start-9">
              Each record carries an official reference in the form <span className="t-ref whitespace-nowrap text-ink-900">AGV-DOC-2026-0001</span>, fixed for good once issued.
            </p>
          </div>

          <div className="mt-20 grid gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-4">
            {record.map((col, i) => (
              <div key={col.title} data-reveal-on style={css({ "--stagger": i })} className="border-t-2 border-navy-800 pt-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="t-h3">{col.title}</h3>
                  <span className="t-ref text-ink-500">{col.listing.items.length} published</span>
                </div>
                {col.listing.items.length === 0 ? (
                  <EmptyRecord compact pattern={col.pattern} title={col.listing.source === "unavailable" ? "Temporarily unavailable." : "Nothing published yet."}>
                    {col.empty}
                  </EmptyRecord>
                ) : (
                  <ul className="my-5">
                    {col.listing.items.map((r) => (
                      <li key={r.reference} className="border-b rule">
                        <Link href={`${col.href}/${r.slug}`} className="group block py-4">
                          <span className="flex items-center justify-between gap-3">
                            <span className="t-ref text-[0.75rem] text-gold-700">{r.reference}</span>
                            <span className="t-ref text-[0.75rem] text-ink-500">{formatDateShort(r.publishedAt)}</span>
                          </span>
                          <span className="mt-1.5 block text-[1rem] font-medium leading-snug text-ink-900 group-hover:text-navy-600">{r.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={col.href} className="group mt-2 inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-navy-800">
                  <span className="draw-link">Open the register</span>
                  <span aria-hidden className="arrow-nudge">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* § 06 — Build the institutional operating system (Sea) */}
      <section aria-labelledby="s06" className="sea relative overflow-hidden">
        <Contours variant="c" tone="gold" opacity={0.18} parallax={0.08} />
        <div className="shell relative grid-12 py-[clamp(8rem,16vw,15rem)]">
          <div className="col-span-12 lg:col-span-10 lg:col-start-2">
            <SectionMark n="06" label="The guiding principle" tone="sea" />
            <p id="s06" data-reveal-on className="t-display mt-12 text-parchment-50">
              Build the institutional operating system <span className="text-gold-400">before the physical state.</span>
            </p>
            <div className="mt-16 flex flex-wrap gap-x-12 gap-y-5 border-t rule pt-8">
              <Link href="/documents" className="group inline-flex items-center gap-3 text-[1.0625rem] font-semibold text-parchment-50">
                <span className="draw-link">Explore the record</span>
                <span aria-hidden className="arrow-nudge text-gold-400">→</span>
              </Link>
              <Link href="/register-interest" className="group inline-flex items-center gap-3 text-[1.0625rem] font-semibold text-parchment-50">
                <span className="draw-link">Register your interest</span>
                <span aria-hidden className="arrow-nudge text-gold-400">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
