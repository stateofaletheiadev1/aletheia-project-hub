"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { activeHref, type NavGroup } from "./navigation";

// The left rail (brief §13.1): light and editorial, parchment with navy text, grouped under
// small overlines. The active item carries a navy bar and the sheet surface. Counts show only
// what the official is entitled to know.

export function Rail({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeHref(groups, pathname);
  return (
    <nav aria-label="Workbench" className="grid gap-6 px-3 py-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="caps px-3 pb-1.5 text-ink-3">{g.label}</p>
          <ul className="grid">
            {g.items.map((item) => {
              const on = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "relative flex h-8 items-center justify-between gap-3 rounded-xs px-3 text-ui transition-colors duration-(--dur-quick) pointer-coarse:h-11",
                      on ? "bg-sheet font-semibold text-authority" : "font-medium text-ink-2 hover:bg-rule-faint hover:text-ink",
                    )}
                  >
                    {on ? <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-authority" /> : null}
                    <span className="truncate">{item.label}</span>
                    {item.count ? (
                      <span className={cx("tnum text-meta", on ? "text-authority" : "text-ink-3")}>
                        {item.count}
                        <span className="sr-only"> items</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
