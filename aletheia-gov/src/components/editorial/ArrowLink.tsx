import Link from "next/link";

export function ArrowLink({
  href,
  children,
  tone = "ledger",
  external = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "ledger" | "sea";
  external?: boolean;
  className?: string;
}) {
  const cls = `group inline-flex items-center gap-3 text-[1rem] font-semibold ${tone === "sea" ? "text-gold-300" : "text-navy-800"} ${className}`;
  const inner = (
    <>
      <span className="draw-link">{children}</span>
      <span aria-hidden className="arrow-nudge">
        {external ? "↗" : "→"}
      </span>
    </>
  );
  return external ? (
    <a href={href} className={cls} rel="noopener">
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
