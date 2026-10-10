// Every demonstration record is labelled where it appears (brief §19).
export function DemoTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center border border-[#9b2c2c] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#9b2c2c] ${className}`}>
      Demonstration data
    </span>
  );
}
