// A designed empty state for a part of the public record that has nothing published yet.
// It shows the shape of what will appear, never a fake entry (brief §1.2).
export function EmptyRecord({
  title,
  children,
  pattern,
  tone = "ledger",
  compact = false,
}: {
  title: string;
  children?: React.ReactNode;
  pattern: string;
  tone?: "ledger" | "sea";
  compact?: boolean;
}) {
  const sea = tone === "sea";
  return (
    <div className={`relative ${compact ? "py-6" : "py-10 md:py-14"}`}>
      <div aria-hidden className="space-y-[1.15rem]">
        {[0, 1, 2].slice(0, compact ? 2 : 3).map((i) => (
          <div key={i} className="flex items-center gap-4">
            <span className={`t-ref ${sea ? "text-navy-400" : "text-parchment-500"}`}>{pattern}</span>
            <span className={`h-px flex-1 ${sea ? "bg-navy-700" : "bg-parchment-300"}`} style={{ maxWidth: `${88 - i * 18}%` }} />
          </div>
        ))}
      </div>
      <div className={compact ? "mt-6" : "mt-10"}>
        <p className={`text-[1.0625rem] font-semibold ${sea ? "text-parchment-50" : "text-ink-900"}`}>{title}</p>
        {children ? <div className={`mt-2 max-w-[56ch] text-[0.9375rem] leading-relaxed ${sea ? "text-parchment-300" : "text-ink-600"}`}>{children}</div> : null}
      </div>
    </div>
  );
}
