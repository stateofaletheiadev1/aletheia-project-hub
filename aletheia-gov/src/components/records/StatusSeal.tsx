import { STATUS_META, type InstitutionalStatus } from "@/lib/status";

// A small circular mark plus a text label. Never colour alone (brief §5.2):
// each status has its own glyph, so the mark reads in greyscale too.
function Glyph({ status }: { status: InstitutionalStatus }) {
  const ring = <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" />;
  switch (status) {
    case "proposed":
      return <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.6" />;
    case "planned":
      return ring;
    case "in_formation":
      return (
        <>
          {ring}
          <path d="M7 1.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
        </>
      );
    case "in_development":
      return (
        <>
          {ring}
          <path d="M7 7V1.5A5.5 5.5 0 1 1 1.5 7z" fill="currentColor" />
        </>
      );
    case "recruiting":
      return (
        <>
          {ring}
          <circle cx="7" cy="7" r="2.2" fill="currentColor" />
        </>
      );
    case "established":
      return <circle cx="7" cy="7" r="5.5" fill="currentColor" />;
    case "operational":
      return (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4.3 7.2 6.2 9l3.6-4" fill="none" stroke="var(--parchment-50)" strokeWidth="1.4" />
        </>
      );
    case "suspended":
      return (
        <>
          {ring}
          <path d="M3.2 10.8 10.8 3.2" stroke="currentColor" strokeWidth="1.2" />
        </>
      );
    case "archived":
      return (
        <>
          {ring}
          <path d="M3.5 7h7" stroke="currentColor" strokeWidth="1.2" />
        </>
      );
  }
}

export function StatusSeal({
  status,
  tone = "ledger",
  className = "",
}: {
  status: InstitutionalStatus;
  tone?: "ledger" | "sea";
  className?: string;
}) {
  const meta = STATUS_META[status];
  const colour =
    status === "operational"
      ? tone === "sea" ? "text-green-300" : "text-green-700"
      : tone === "sea" ? "text-gold-400" : "text-gold-700";
  return (
    <span className={`relative inline-flex items-center gap-2 whitespace-nowrap ${className}`} title={meta.meaning}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className={`shrink-0 ${colour}`}>
        <Glyph status={status} />
      </svg>
      <span className={`text-[0.75rem] font-semibold uppercase tracking-[0.12em] ${tone === "sea" ? "text-parchment-200" : "text-ink-700"}`}>
        <span className="sr-only">Status: </span>
        {meta.label}
      </span>
    </span>
  );
}
