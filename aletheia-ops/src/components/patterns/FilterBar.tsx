import Link from "next/link";
import { cx } from "@/lib/cx";

// Register filters (brief §13.2): a plain GET form, so filters are in the address, shareable,
// and work without JavaScript. Counts and options come from what the official may see.

export type FilterOption = { value: string; label: string };
export type FilterDef = { name: string; label: string; options: FilterOption[] };

export function FilterBar({
  action,
  filters,
  values,
  query,
  queryLabel = "Search this register",
  total,
}: {
  action: string;
  filters: FilterDef[];
  values: Record<string, string | undefined>;
  query?: string;
  queryLabel?: string;
  total?: { shown: number; of: number };
}) {
  const active = filters.filter((f) => values[f.name]).length + (query ? 1 : 0);
  return (
    <form action={action} method="get" role="search" className="grid gap-3 border-b border-rule pb-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-56 flex-1 gap-1">
          <span className="caps text-ink-2">{queryLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Reference or title"
            className="h-9 rounded-sm border border-rule-control bg-sheet px-3 text-ui text-ink placeholder:text-ink-3 hover:border-ink-2 focus-visible:border-authority"
          />
        </label>
        {filters.map((f) => (
          <label key={f.name} className="grid gap-1">
            <span className="caps text-ink-2">{f.label}</span>
            <select
              name={f.name}
              defaultValue={values[f.name] ?? ""}
              className={cx(
                "h-9 max-w-56 rounded-sm border bg-sheet pr-8 pl-3 text-ui hover:border-ink-2 focus-visible:border-authority",
                values[f.name] ? "border-authority font-semibold text-authority" : "border-rule-control text-ink",
              )}
            >
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="h-9 rounded-sm bg-authority px-4 text-ui font-semibold text-ink-inverse hover:bg-authority-hover">
          Apply filters
        </button>
      </div>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-3 text-meta text-ink-2">
        {total ? (
          <p className="tnum" aria-live="polite">
            {total.of === 0 ? "No records" : `Showing ${total.shown} of ${total.of} ${total.of === 1 ? "record" : "records"}`}
          </p>
        ) : (
          <span />
        )}
        {active > 0 ? (
          <Link href={action} className="link font-semibold">
            Clear {active === 1 ? "filter" : `${active} filters`}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
