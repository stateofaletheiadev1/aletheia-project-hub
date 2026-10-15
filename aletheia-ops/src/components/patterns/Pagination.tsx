import Link from "next/link";
import { cx } from "@/lib/cx";

// Server-side pagination (brief §13.2): previous and next, with the range in words.

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-9 items-center gap-2 rounded-sm px-3 text-ui font-semibold";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4 border-t border-rule pt-4">
      <p className="tnum text-meta text-ink-2">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cx(link, "text-authority hover:bg-authority-tint")} rel="prev">
            <span aria-hidden>←</span> Previous
          </Link>
        ) : (
          <span className={cx(link, "text-ink-3")} aria-disabled>
            <span aria-hidden>←</span> Previous
          </span>
        )}
        <span className="tnum px-2 text-meta text-ink-2">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={cx(link, "text-authority hover:bg-authority-tint")} rel="next">
            Next <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className={cx(link, "text-ink-3")} aria-disabled>
            Next <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </nav>
  );
}
