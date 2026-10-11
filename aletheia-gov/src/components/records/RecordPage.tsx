import { notFound } from "next/navigation";
import { ArrowLink } from "@/components/editorial/ArrowLink";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { formatDateLong } from "@/lib/dates";
import { getPublished, type Block, type RecordKind } from "@/server/records/public-records";

const LABEL: Record<RecordKind, string> = {
  opportunity: "Founding opportunity",
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
                ...record.facts.map((f) => ({ label: f.label, value: f.value })),
              ]}
            />
          }
        >
          <article className="prose-ledger">
            {record.body.length ? record.body.map((b, i) => <BlockView key={i} block={b} />) : <p className="text-ink-600">This record has no further text.</p>}
          </article>
          <div className="mt-14">
            <ArrowLink href={back.href}>{back.label}</ArrowLink>
          </div>
        </Folio>
      </div>
    </>
  );
}
