import type { Metadata } from "next";
import { EmptyRecord } from "@/components/editorial/EmptyRecord";
import { FoundingNotice } from "@/components/editorial/FoundingNotice";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { StatusSeal } from "@/components/records/StatusSeal";
import Link from "next/link";
import { formatDateShort } from "@/lib/dates";
import { listPublished } from "@/server/records/public-records";

export const metadata: Metadata = {
  title: "Public finance",
  description:
    "Public finance of the founding government of Aletheia: the Reserve Bank and the Treasury, kept apart. Figures appear only from published records.",
};

const RECORD_TYPES = ["Budgets", "Receipts", "Expenditure", "Procurement notices", "Contracts", "Funding commitments", "Audited statements", "Reports"];

const RULES = [
  ["Every record has a source", "Each finance record names its currency, period, status, source document and approver."],
  ["Amounts are exact", "Amounts are stored as whole numbers of the currency’s smallest unit, so totals never drift by rounding."],
  ["Totals show their basis", "A total is always shown with what it adds up, for example: “Sum of 3 published expenditure records, period Q3 2026”."],
  ["Two approvers", "Publishing or changing a finance record needs a second, different authorised officer."],
] as const;

export default async function PublicFinancePage() {
  const finance = await listPublished("finance", { limit: 50, withTotal: true });
  const sides = [
    {
      id: "monetary",
      name: "Reserve Bank of Aletheia",
      role: "Issues the Aletheian Guilder (AEY) under published rules. Its reserves are never spent on construction or lent to the State.",
      note: "The Bank is being established. Its monetary framework will be published before any currency is issued.",
    },
    {
      id: "treasury",
      name: "Treasury and Public Finance",
      role: "Keeps the budget, receipts and expenditure of the founding government.",
      note: "No budget has been adopted. No first report date has been decided.",
    },
  ];

  return (
    <>
      <PageHead
        mark={{ n: "R6", label: "Public finance" }}
        title="Public finance"
        lede="Money issued and money spent, kept apart and both on the record. Figures appear here only from published records, never from estimates."
        contour="c"
      />
      <FoundingNotice variant="banner" />

      <section aria-labelledby="separation" className="ledger chapter">
        <div className="shell">
          <SectionMark n="01" label="Two institutions" />
          <h2 id="separation" className="t-display mt-8 max-w-[18ch]">
            The body that issues money does not spend it.
          </h2>

          <div className="mt-20 grid gap-x-16 gap-y-20 lg:grid-cols-2">
            {sides.map((s) => (
              <section key={s.id} aria-labelledby={s.id} className="border-t-2 border-navy-800 pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h3 id={s.id} className="t-h2">
                    {s.name}
                  </h3>
                  <StatusSeal status="proposed" />
                </div>
                <p className="mt-4 text-[1.0625rem] text-ink-700">{s.role}</p>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600">{s.note}</p>
                <EmptyRecord compact pattern="AGV-FIN-····-····" title={`No ${s.id === "monetary" ? "monetary" : "treasury"} records published.`} />
              </section>
            ))}
          </div>
        </div>
      </section>

      {finance.items.length ? (
        <section aria-labelledby="published" className="ledger-pale chapter">
          <div className="shell">
            <SectionMark n="R" label="Published finance records" />
            <h2 id="published" className="t-h1 mt-8">
              On the record
            </h2>
            <ol className="mt-12 border-t-2 border-navy-800">
              {finance.items.map((r) => (
                <li key={r.reference} className="border-b rule">
                  <Link href={`/public-finance/${r.slug}`} className="grid gap-2 py-6 md:grid-cols-[13rem_1fr_auto] md:gap-8">
                    <span className="t-ref text-gold-700">{r.reference}</span>
                    <span>
                      <span className="block text-[1.125rem] font-medium">{r.title}</span>
                      {r.summary ? <span className="mt-1 block text-[0.9375rem] text-ink-600">{r.summary}</span> : null}
                    </span>
                    <span className="t-ref text-ink-500">{formatDateShort(r.publishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="rules" className="sea chapter">
        <div className="shell grid-12 gap-y-14">
          <div className="col-span-12 lg:col-span-4">
            <SectionMark n="02" label="Rules for figures" tone="sea" />
            <h2 id="rules" className="t-h1 mt-8 text-parchment-50">
              How a number gets onto this page.
            </h2>
            <p className="mt-6 text-[0.9375rem] text-parchment-300">
              Published finance records: <span className="t-ref text-parchment-50">{finance.total ?? finance.items.length}</span>
            </p>
          </div>
          <ol className="col-span-12 border-t rule lg:col-span-7 lg:col-start-6">
            {RULES.map(([title, text], i) => (
              <li key={title} className="grid gap-2 border-b rule py-7 md:grid-cols-[3rem_1fr] md:gap-6">
                <span className="t-ref text-gold-400">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-[1.125rem] font-medium text-parchment-50">{title}</span>
                  <span className="mt-2 block text-[0.9375rem] leading-relaxed text-parchment-300">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="types" className="ledger-pale chapter">
        <div className="shell grid-12 gap-y-10">
          <div className="col-span-12 lg:col-span-4">
            <SectionMark n="03" label="What will be published" />
            <h2 id="types" className="t-h2 mt-8">
              Record types
            </h2>
          </div>
          <ul className="col-span-12 grid grid-cols-2 gap-x-10 border-t rule sm:grid-cols-4 lg:col-span-7 lg:col-start-6">
            {RECORD_TYPES.map((t) => (
              <li key={t} className="border-b rule py-5 text-[1rem]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
