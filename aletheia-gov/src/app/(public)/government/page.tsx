import type { Metadata } from "next";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { FoundingNotice } from "@/components/editorial/FoundingNotice";
import { PageHead } from "@/components/editorial/PageHead";
import { SectionMark } from "@/components/editorial/SectionMark";
import { Contours } from "@/components/brand/Contours";
import { StatusSeal } from "@/components/records/StatusSeal";
import { principles } from "@/content/founding";
import { INSTITUTIONAL_STATUSES, STATUS_META } from "@/lib/status";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "The founding government",
  description:
    "What the founding government of Aletheia is, what it does, how it is organised and how it is held to account.",
};

export default function GovernmentPage() {
  return (
    <>
      <PageHead
        mark={{ n: "G1", label: "The government" }}
        title="The founding government"
        lede="A government-in-formation that builds institutions, infrastructure and a public record before it governs any place."
        image="horizon"
      />
      <FoundingNotice variant="banner" />

      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Status", value: <StatusSeal status="in_formation" /> },
                { label: "Territory", value: "None held or claimed" },
                { label: "Recognition", value: "None" },
                { label: "Officeholders", value: "Published in the register of appointments" },
                { label: "National website", value: <a className="link-ledger" href={site.nationalSite}>stateofaletheia.org</a> },
              ]}
            />
          }
        >
          <article className="prose-ledger">
            <p className="t-lede text-ink-900">
              The Sovereign Covenant State of Aletheia is in its founding phase. The founding government is the body doing the work of that phase. Its status is <strong className="font-semibold">in formation</strong>: work is assigned and under way, but it does not yet function as a government of a place.
            </p>
            <p>
              This site answers a narrow question: who is building Aletheia, how, and how they can be held to account. For what Aletheia is, its symbols, its constitutional vision and its currency, see the national website, stateofaletheia.org.
            </p>

            <h2>What it does</h2>
            <ul>
              <li>Drafts the founding framework: the constitution, the institutions it creates, and the limits on each.</li>
              <li>Builds the infrastructure institutions will run on: Aletheia StableChain, AletheiaDB, and this platform.</li>
              <li>Recruits founding contributors in the open and publishes every appointment.</li>
              <li>Prepares the monetary and fiscal frameworks, keeping issuance separate from spending.</li>
              <li>Publishes its documents, decisions and finances with official references.</li>
            </ul>

            <h2>What it does not do</h2>
            <p>
              It holds no territory and claims none. It issues no passports, collects no taxes and conducts no diplomatic relations. It does not describe any institution as functioning unless that is verified and the evidence is on the record.
            </p>
            <p>
              Aletheia will not lease land from another state, because a lease can be taken back. Its territory is to be a seastead: platforms that Aletheia designs, builds and owns, beginning with a single pilot platform. The plan, and how it would be financed, is set out on{" "}
              <a href="https://stateofaletheia.org/development#seastead">stateofaletheia.org</a>.
            </p>

            <h2>How it is organised</h2>
            <p>
              The founding government works through institutions in formation. Each is described in the institutional framework with its mandate, its basis and its status. An institution moves from <em>proposed</em> to <em>in formation</em> when people and work are assigned to it, and to <em>operational</em> only with evidence and the approval of a second authorised officer.
            </p>
            <p>
              Platform administration is kept apart from institutional authority. The people who run this website cannot, by that role alone, approve appointments, decisions or finance records.
            </p>

            <h2>How it is held to account</h2>
            <ul>
              <li>Every public record has a reference in the form <span className="t-ref">AGV-DEC-2026-0001</span>, fixed once issued.</li>
              <li>Privileged acts need two different people: appointments, decisions, finance records and any change to <em>operational</em> status.</li>
              <li>Status changes and amendments appear in each record’s public change history.</li>
              <li>Figures are published only from records, with the basis of every total shown.</li>
            </ul>
          </article>

          <div className="mt-14 flex flex-wrap gap-x-10 gap-y-4">
            <ArrowLink href="/institutions">The institutional framework</ArrowLink>
            <ArrowLink href="/founding-programme">The founding programme</ArrowLink>
          </div>
        </Folio>
      </div>

      {/* Principles (Sea) */}
      <section aria-labelledby="principles" className="sea chapter relative overflow-hidden">
        <Contours variant="a" opacity={0.06} parallax={0.05} />
        <div className="shell relative">
          <SectionMark n="G2" label="Principles" tone="sea" />
          <h2 id="principles" className="t-display mt-8 max-w-[16ch] text-parchment-50">
            Five rules the founding government keeps.
          </h2>
          <ol className="mt-20 grid gap-x-10 border-t rule md:grid-cols-2 xl:grid-cols-5">
            {principles.map((p, i) => (
              <li key={p.title} data-reveal-on style={{ "--stagger": i } as React.CSSProperties} className="border-b rule py-10 xl:border-b-0 xl:pr-4">
                <p className="t-ref text-gold-400">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-5 text-[1.375rem] font-light leading-tight tracking-[-0.01em] text-parchment-50">{p.title}</p>
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-parchment-300">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Status legend (Ledger) */}
      <section aria-labelledby="statuses" className="ledger-pale chapter">
        <div className="shell grid-12 gap-y-12">
          <div className="col-span-12 lg:col-span-4">
            <SectionMark n="G3" label="Reading the record" />
            <h2 id="statuses" className="t-h1 mt-8">
              Every status, defined.
            </h2>
            <p className="mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed text-ink-600">
              Each institution and programme carries exactly one of these. The mark differs by shape, not only colour.
            </p>
          </div>
          <dl className="col-span-12 border-t rule lg:col-span-7 lg:col-start-6">
            {INSTITUTIONAL_STATUSES.map((s) => (
              <div key={s} className="grid grid-cols-[11rem_1fr] items-baseline gap-6 border-b rule py-5">
                <dt>
                  <StatusSeal status={s} />
                </dt>
                <dd className="text-[0.9844rem] text-ink-700">{STATUS_META[s].meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
