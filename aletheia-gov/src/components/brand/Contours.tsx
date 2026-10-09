// Abstract bathymetric contour field (scripts/contours.mjs). Decorative only.
// A static, cacheable SVG. (Inlining it was measured and rejected: React repeats server
// output in the RSC payload, so the paths were sent twice and HTML weight doubled.)
type Props = {
  variant?: "a" | "b" | "c";
  tone?: "light" | "gold" | "ink";
  opacity?: number;
  parallax?: number;
  className?: string;
  /** Above the fold: load immediately instead of lazily. */
  eager?: boolean;
};

export function Contours({ variant = "a", tone = "light", opacity = 0.08, parallax, className = "", eager = false }: Props) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src={`/contours/field-${variant}-${tone}.svg`}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        data-parallax={parallax}
        className="contour-field absolute -inset-y-[8%] inset-x-0 h-[116%] w-full object-cover will-change-transform"
        style={{ opacity }}
      />
    </div>
  );
}
