import { foundingNotice } from "@/content/founding";

// The founding-stage notice (brief §5.1). Required in the colophon of every page and
// as a banner on /government, /institutions, /public-finance and /appointments.
export function FoundingNotice({ variant }: { variant: "banner" | "colophon" }) {
  if (variant === "colophon") {
    return (
      <aside aria-label="Founding-stage notice" className="flex gap-4">
        <span aria-hidden className="mt-1.5 block h-[7px] w-[7px] shrink-0 rotate-45 border border-gold-500" />
        <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-parchment-300">{foundingNotice}</p>
      </aside>
    );
  }
  return (
    <aside aria-label="Founding-stage notice" className="border-y rule bg-parchment-50/70">
      <div className="shell flex flex-col gap-2 py-5 md:flex-row md:items-baseline md:gap-10">
        <p className="t-meta shrink-0 text-gold-700">Founding-stage notice</p>
        <p className="max-w-[88ch] text-[0.9375rem] leading-relaxed text-ink-700">{foundingNotice}</p>
      </div>
    </aside>
  );
}
