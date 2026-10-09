// The margin column (brief §6.4): columns 1–3 carry sticky metadata, columns 4–10 the text.
// On small screens the margin becomes a metadata block above the text.
export type MarginItem = { label: string; value: React.ReactNode };

export function MarginMeta({ items }: { items: MarginItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t rule pt-5 lg:grid-cols-1">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="t-meta text-[0.6875rem] text-ink-500">{it.label}</dt>
          <dd className="mt-1.5 text-[0.9375rem] leading-snug text-ink-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Folio({ margin, children, className = "" }: { margin: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`shell grid-12 gap-y-10 ${className}`}>
      <aside className="col-span-12 lg:col-span-3">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)]">{margin}</div>
      </aside>
      <div className="col-span-12 lg:col-span-7 lg:col-start-5">{children}</div>
    </div>
  );
}
