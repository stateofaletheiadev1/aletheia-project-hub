import { notFound } from "next/navigation";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { positionName } from "@/content/positions";
import { formatDateLong } from "@/lib/dates";
import { getPublished, type Block, type RecordKind } from "@/server/records/public-records";

const LABEL: Record<RecordKind, string> = {
  opportunity: "Opportunity",
  document: "Document",
  decision: "Decision",
  dispatch: "Dispatch",
  finance: "Finance record",
  appointment: "Appointment",
  event: "Event",
};

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "paragraph":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-gold-500 pl-5 text-[1.125rem] font-light italic text-ink-700">
          {block.text}
          {block.source ? <footer className="mt-2 text-[0.875rem] not-italic text-ink-500">{block.source}</footer> : null}
        </blockquote>
      );
  }
}

/** Applications are open until the end of the closing date (UTC). */
export function applicationsOpen(closingDate: string | undefined, now = new Date()): boolean {
  if (!closingDate) return true;
  return now.getTime() < Date.parse(`${closingDate}T23:59:59Z`);
}

function ApplyBlock({ reference, closingDate }: { reference: string; closingDate?: string }) {
  if (!applicationsOpen(closingDate)) {
    return (
      <div className="mt-14 border-t-2 border-ink-400 pt-6">
        <p className="t-h3">Applications closed{closingDate ? ` on ${formatDateLong(closingDate)}` : ""}.</p>
        <p className="mt-2 text-[0.9375rem] text-ink-600">You can still register your interest in future positions.</p>
      </div>
    );
  }
  return (
    <div className="mt-14 border-t-2 border-navy-800 pt-6">
      <p className="t-h3">Apply for this position</p>
      <p className="mt-2 max-w-[56ch] text-[0.9375rem] text-ink-600">
        Give your details and attach your CV as a PDF. Your application is recorded against {reference}
        {closingDate ? ` and must arrive by ${formatDateLong(closingDate)}` : ""}.
      </p>
      <a href={`/register-interest?opportunity=${encodeURIComponent(reference)}`} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-navy-800 px-5 text-[0.9375rem] font-semibold text-parchment-50 hover:bg-navy-950">
        Apply for this position <span aria-hidden>→</span>
      </a>
    </div>
  );
}

/** One published record, set with the margin column (brief §6.4). */
export async function RecordPage({ kind, slug, back }: { kind: RecordKind; slug: string; back: { href: string; label: string } }) {
  const record = await getPublished(kind, slug);
  if (record === "unavailable") {
    return (
      <PageHead mark={{ n: "R", label: LABEL[kind] }} title="The public record is temporarily unavailable." lede="Nothing has been lost. Please try again in a moment." />
    );
  }
  if (!record) notFound();

  return (
    <>
      <PageHead mark={{ n: "R", label: LABEL[kind] }} title={record.title} lede={record.summary ?? ""} contour="a">
        <div className="flex flex-wrap items-center gap-4">
          <span className="t-ref text-gold-300">{record.reference}</span>
        </div>
      </PageHead>
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Reference", value: <span className="t-ref">{record.reference}</span> },
                ...(record.status ? [{ label: "Status", value: record.status }] : []),
                ...(record.issuer ? [{ label: "Issued by", value: record.issuer }] : []),
                { label: "Published", value: formatDateLong(record.publishedAt) },
                ...(record.withdrawn ? [{ label: "Withdrawn", value: formatDateLong(record.withdrawn.at) }] : []),
                ...(record.correctedAt ? [{ label: "Corrected", value: formatDateLong(record.correctedAt) }] : []),
                ...(record.version ? [{ label: "Version", value: String(record.version) }] : []),
                ...(kind === "opportunity" ? [{ label: "Kind of position", value: positionName(record.positionType ?? "founding") }] : []),
                ...(kind === "opportunity" && record.closingDate ? [{ label: "Closing date", value: formatDateLong(record.closingDate) }] : []),
                ...record.facts.map((f) => ({ label: f.label, value: f.value })),
                ...(record.contentHash
                  ? [{ label: "Content hash (SHA-256)", value: <span className="t-ref break-all">{record.contentHash}</span> }]
                  : []),
              ]}
            />
          }
        >
          {record.withdrawn ? (
            <div className="border-l-2 border-gold-700 pl-6">
              <p className="t-meta text-gold-700">Withdrawn from the public record</p>
              <p className="mt-3 t-body">
                This record was withdrawn on {formatDateLong(record.withdrawn.at)}. Its reference, {record.reference}, will not be used again.
              </p>
              {record.withdrawn.reason ? <p className="mt-3 t-body text-ink-700">Reason: {record.withdrawn.reason}</p> : null}
            </div>
          ) : (
            <article className="prose-ledger">
              {record.body.length ? record.body.map((b, i) => <BlockView key={i} block={b} />) : <p className="text-ink-600">This record has no further text.</p>}
            </article>
          )}
          {kind === "opportunity" && !record.withdrawn ? <ApplyBlock reference={record.reference} closingDate={record.closingDate} /> : null}
          <div className="mt-14">
            <ArrowLink href={back.href}>{back.label}</ArrowLink>
          </div>
        </Folio>
      </div>
    </>
  );
}
