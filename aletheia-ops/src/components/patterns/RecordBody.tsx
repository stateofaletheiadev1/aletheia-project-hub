import type { Block, Fact } from "@/domain/content";

// Record text as the public portal renders it: structured blocks only, never HTML (brief §27).

export function RecordBody({ body, facts }: { body: Block[]; facts?: Fact[] }) {
  return (
    <>
      {body.map((b, i) =>
        b.type === "heading" ? (
          <h2 key={i}>{b.text}</h2>
        ) : b.type === "list" ? (
          <ul key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : b.type === "quote" ? (
          <blockquote key={i}>{b.text}</blockquote>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
      {facts && facts.length ? (
        <dl className="label-value mt-8 gap-x-6 gap-y-2 border-t border-rule pt-4 text-ui">
          {facts.map((f, i) => (
            <div key={i} className="contents">
              <dt className="caps pt-0.5 text-ink-3">{f.label}</dt>
              <dd className="text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
