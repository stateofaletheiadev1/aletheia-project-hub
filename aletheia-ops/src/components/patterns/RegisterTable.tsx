import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// The register (brief §8, §13.2): a ruled, numbered ledger, not a grid of cards. Overline
// column headers stay in view; references come first; numbers align on tabular figures.
// Under 768 px the same rows become a stacked list, designed rather than squeezed.

export type Column<R> = {
  key: string;
  header: string;
  /** Tailwind width class from the scale, e.g. "w-44". */
  width?: string;
  align?: "left" | "right";
  /** Hide below this breakpoint in the table layout. */
  hideBelow?: "lg" | "xl" | "2xl";
  render: (row: R) => ReactNode;
};

export function RegisterTable<R extends { id: string }>({
  caption,
  columns,
  rows,
  card,
  rowHref,
  isNew,
  density = "comfortable",
  sortedBy,
}: {
  caption: string;
  columns: Column<R>[];
  rows: R[];
  /** The narrow-screen rendering of one row. */
  card: (row: R) => ReactNode;
  rowHref?: (row: R) => string;
  /** "Since your last visit" marker. */
  isNew?: (row: R) => boolean;
  density?: "comfortable" | "compact";
  sortedBy?: { key: string; direction: "ascending" | "descending" };
}) {
  const rowHeight = density === "compact" ? "h-10" : "h-13";
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-ui md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-canvas">
          <tr className="border-b border-rule-strong">
            <th scope="col" className="w-6 p-0">
              <span className="sr-only">New</span>
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sortedBy?.key === c.key ? sortedBy.direction : undefined}
                className={cx(
                  "caps h-10 px-3 text-ink-2 first-of-type:pl-0",
                  c.align === "right" ? "text-right" : "text-left",
                  c.width,
                  c.hideBelow === "lg" && "hidden lg:table-cell",
                  c.hideBelow === "xl" && "hidden xl:table-cell",
                  c.hideBelow === "2xl" && "hidden 2xl:table-cell",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fresh = isNew?.(row) ?? false;
            return (
              <tr key={row.id} className="group relative border-b border-rule transition-colors duration-(--dur-quick) hover:bg-sheet" data-row>
                <td className="p-0 align-middle">
                  {fresh ? (
                    <span className="flex justify-center" title="New since your last visit">
                      <span className="size-1.5 rounded-full bg-authority" />
                      <span className="sr-only">New since your last visit</span>
                    </span>
                  ) : null}
                </td>
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cx(
                      rowHeight,
                      "px-3 align-middle",
                      i === 0 && "pl-0",
                      c.align === "right" && "text-right",
                      c.hideBelow === "lg" && "hidden lg:table-cell",
                      c.hideBelow === "xl" && "hidden xl:table-cell",
                      c.hideBelow === "2xl" && "hidden 2xl:table-cell",
                    )}
                  >
                    {/* The first cell carries the row link; it stretches over the whole row. */}
                    {i === 1 && rowHref ? (
                      <a href={rowHref(row)} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-focus">
                        {c.render(row)}
                      </a>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ol className="grid border-t border-rule-strong md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="relative border-b border-rule py-4">
            {isNew?.(row) ? <span className="absolute top-5.5 -left-3 size-1.5 rounded-full bg-authority" title="New since your last visit" /> : null}
            {rowHref ? (
              <a href={rowHref(row)} className="block">
                {card(row)}
              </a>
            ) : (
              card(row)
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
