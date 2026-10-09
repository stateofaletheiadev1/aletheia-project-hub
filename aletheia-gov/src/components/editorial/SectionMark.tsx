export function SectionMark({ n, label, tone = "ledger", className = "" }: { n: string; label?: string; tone?: "ledger" | "sea"; className?: string }) {
  return (
    <p className={`section-mark t-meta ${tone === "sea" ? "text-gold-400" : "text-gold-700"} ${className}`}>
      <span>§ {n}</span>
      {label ? <span className={tone === "sea" ? "text-parchment-300" : "text-ink-600"}>{label}</span> : null}
    </p>
  );
}
