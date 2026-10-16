import { APPLICATION_STATUS_LABEL, isApplicationStatus } from "@/lib/application-status";

export function WorkbenchHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-10 border-b border-[var(--rule-ledger)] pb-6">
      <p className="t-meta text-[0.6875rem] text-gold-700">{eyebrow}</p>
      <h1 className="mt-2 text-[clamp(1.75rem,2.6vw,2.25rem)] font-light tracking-[-0.02em]">{title}</h1>
      {children ? <div className="mt-3 max-w-[70ch] text-[0.9375rem] text-ink-600">{children}</div> : null}
    </header>
  );
}

const STATUS_STYLE: Record<string, string> = {
  new: "border-navy-800 text-navy-800",
  contacted: "border-green-700 text-green-700",
  shortlisted: "border-gold-700 text-gold-700",
  offered: "border-gold-700 text-gold-700",
  appointed: "border-green-700 bg-green-700 text-parchment-50",
  not_progressed: "border-ink-500 text-ink-600",
  archived: "border-ink-500 text-ink-600",
};

export function StatusPill({ status }: { status: string }) {
  const label = isApplicationStatus(status) ? APPLICATION_STATUS_LABEL[status] : status;
  return <span className={`inline-flex border px-2 py-0.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] ${STATUS_STYLE[status] ?? "border-ink-500"}`}>{label}</span>;
}
