import { cx } from "@/lib/cx";

// The portal's contour-line fields: the only ornament in the workbench, at very low contrast,
// on the sign-in screen, empty states and the briefing masthead; never behind data (brief §8).
export function Contours({ variant = "a", tone = "ink", opacity = 0.07, className }: { variant?: "a" | "b" | "c"; tone?: "light" | "ink"; opacity?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src={`/contours/field-${variant}-${tone}.svg`} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" style={{ opacity }} />
    </div>
  );
}
