import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/brand/Contours";
import { SectionMark } from "@/components/editorial/SectionMark";
import { StatusSeal } from "@/components/records/StatusSeal";
import { search } from "@/server/search";

export const metadata: Metadata = {
  title: "Search the record",
  description: "Search institutions, programmes, pages and published records of the founding government of Aletheia.",
  alternates: { canonical: "/search" },
};

const SUGGESTIONS = ["Reserve Bank", "StableChain", "proposed", "Treasury", "appointments", "Antioch"];

export default async function SearchPage(props: PageProps<"/search">) {
  const raw = (await props.searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 120).trim() ?? "";
  const hits = q ? search(q) : [];

  return (
    <>
      <header className="sea relative overflow-hidden">
        <Contours variant="a" opacity={0.07} eager />
        <div className="shell relative pb-16 pt-[calc(var(--header-h)+4.5rem)] md:pb-20 md:pt-[calc(var(--header-h)+6rem)]">
          <SectionMark n="S" label="Search" tone="sea" />
          <h1 id="page-title" tabIndex={-1} className="t-h1 mt-8 text-parchment-50 outline-none">
            Search the record
          </h1>
          <form action="/search" method="get" role="search" className="mt-10 max-w-3xl">
            <label htmlFor="q" className="t-meta text-[0.6875rem] text-parchment-300">
              Institutions, programmes, pages and published records
            </label>
            <div className="mt-3 flex border-b border-gold-500 focus-within:border-parchment-50">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                maxLength={120}
                autoComplete="off"
                placeholder="For example: Reserve Bank"
                className="min-w-0 flex-1 bg-transparent py-4 text-[clamp(1.5rem,3vw,2.25rem)] font-light text-parchment-50 placeholder:text-navy-400 focus:outline-none"
              />
              <button type="submit" className="shrink-0 px-2 text-[0.9375rem] font-semibold uppercase tracking-[0.12em] text-gold-300 hover:text-parchment-50">
                Search
              </button>
            </div>
          </form>
        </div>
      </header>

      <div className="ledger min-h-[50vh] py-[clamp(3rem,6vw,6rem)]">
        <div className="shell grid-12 gap-y-8">
          <div className="col-span-12 lg:col-span-3">
            <p className="t-meta text-[0.6875rem] text-ink-500" aria-live="polite">
              {q ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "Suggestions"}
            </p>
          </div>
          <div className="col-span-12 lg:col-span-8 lg:col-start-5">
            {!q ? (
              <ul className="flex flex-wrap gap-3">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/search?q=${encodeURIComponent(s)}`}
                      className="inline-block border border-[var(--rule-ledger)] px-4 py-2 text-[0.9375rem] transition-colors hover:border-navy-800 hover:bg-navy-800 hover:text-parchment-50"
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : hits.length === 0 ? (
              <div className="border-t-2 border-navy-800 pt-8">
                <p className="text-[1.25rem] font-medium">Nothing matches “{q}”.</p>
                <p className="mt-3 max-w-[56ch] text-[0.9375rem] text-ink-600">
                  Search covers only what is published on this site. Try a shorter term, or the name of an institution or programme.
                </p>
              </div>
            ) : (
              <ol className="border-t-2 border-navy-800">
                {hits.map((h) => (
                  <li key={h.href + h.title} className="border-b rule">
                    <Link href={h.href} className="group grid gap-2 py-6 md:grid-cols-[1fr_auto] md:gap-8">
                      <span>
                        <span className="t-meta text-[0.6875rem] text-gold-700">{h.kind}</span>
                        <span className="mt-1.5 block text-[1.25rem] font-medium group-hover:text-navy-600">{h.title}</span>
                        <span className="mt-1 block text-[0.9375rem] text-ink-600">{h.excerpt}</span>
                      </span>
                      {h.status ? <StatusSeal status={h.status} /> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
