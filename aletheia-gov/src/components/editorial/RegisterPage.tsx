import Link from "next/link";
import { EmptyRecord } from "@/components/editorial/EmptyRecord";
import { Folio, MarginMeta, type MarginItem } from "@/components/editorial/Folio";
import { FoundingNotice } from "@/components/editorial/FoundingNotice";
import { PageHead } from "@/components/editorial/PageHead";
import { positionName } from "@/content/positions";
import { formatDateShort } from "@/lib/dates";
import { listPublished, type RecordKind } from "@/server/records/public-records";

// A register of one kind of public record: documents, decisions, dispatches and so on.
// Shows published records only, or a designed empty state that explains what will appear.
export async function RegisterPage({
  kind,
  mark,
  title,
  lede,
  image,
  pattern,
  margin,
  emptyTitle,
  emptyText,
  notice = false,
  basePath,
  children,
}: {
  kind: RecordKind;
  mark: { n: string; label: string };
  title: string;
  lede: string;
  image?: string;
  pattern: string;
  margin: MarginItem[];
  emptyTitle: string;
  emptyText: React.ReactNode;
  notice?: boolean;
  basePath: string;
  children?: React.ReactNode;
}) {
  const listing = await listPublished(kind, { limit: 50, withTotal: true });
  return (
    <>
      <PageHead mark={mark} title={title} lede={lede} image={image} />
      {notice ? <FoundingNotice variant="banner" /> : null}
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio margin={<MarginMeta items={[{ label: "Published records", value: <span className="t-ref text-[0.9375rem]">{listing.total ?? listing.items.length}</span> }, ...margin]} />}>
          <section aria-labelledby="register-heading">
            <div className="flex items-baseline justify-between border-b-2 border-navy-800 pb-4">
              <h2 id="register-heading" className="t-h3">
                The register
              </h2>
              <span className="t-ref text-ink-500">Newest first</span>
            </div>
            {listing.items.length === 0 ? (
              <EmptyRecord pattern={pattern} title={emptyTitle}>
                {emptyText}
                {listing.source === "not_configured" ? (
                  <p className="mt-3 text-[0.8125rem] text-ink-500">The public record database is not yet connected to this site.</p>
                ) : null}
                {listing.source === "unavailable" ? (
                  <p className="mt-3 text-[0.8125rem] font-medium text-[#9b2c2c]">The public record is temporarily unavailable. Please try again shortly.</p>
                ) : null}
              </EmptyRecord>
            ) : (
              <ol>
                {listing.items.map((r) => (
                  <li key={r.reference} className="border-b rule">
                    <Link href={`${basePath}/${r.slug}`} className="grid gap-2 py-6 md:grid-cols-[13rem_1fr_auto] md:gap-8">
                      <span className="t-ref text-gold-700">{r.reference}</span>
                      <span>
                        {kind === "opportunity" ? <span className="t-meta block text-[0.625rem] text-gold-700">{positionName(r.positionType ?? "founding")}</span> : null}
                        <span className="block text-[1.125rem] font-medium">{r.title}</span>
                        {r.summary ? <span className="mt-1 block text-[0.9375rem] text-ink-600">{r.summary}</span> : null}
                      </span>
                      <span className="t-ref text-ink-500">{formatDateShort(r.publishedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {children ? <div className="mt-20">{children}</div> : null}
        </Folio>
      </div>
    </>
  );
}
