"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "./CommandPalette";
import { Masthead, type MastheadOfficial } from "./Masthead";
import type { NavGroup } from "./navigation";
import { Rail } from "./Rail";

// The application frame (brief §13.1): masthead, rail, the working area, and a quiet footer line
// with the build, the environment and when the data was last true.

export function AppFrame({
  official,
  environment,
  unread,
  groups,
  build,
  simulatedPublication,
  footerNote,
  notice,
  children,
}: {
  official: MastheadOfficial;
  environment: "production" | "staging" | "development";
  unread: number;
  groups: NavGroup[];
  build: string;
  /** Brief §31.6: a persistent banner while the development publication adapter is in use. */
  simulatedPublication?: boolean;
  footerNote?: ReactNode;
  /** A full-width notice under the masthead, e.g. that content is specimen. */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [search, setSearch] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 bg-sheet px-4 py-2 text-ui font-semibold text-authority focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Masthead official={official} environment={environment} unread={unread} groups={groups} onSearch={() => setSearch(true)} />
      {simulatedPublication ? (
        <div role="status" className="border-b border-status-returned bg-status-returned-tint px-5 py-2 text-ui font-semibold text-status-returned">
          Publication is simulated in this environment. Nothing released here reaches aletheiagov.org.
        </div>
      ) : null}
      {notice}
      <div className="flex flex-1">
        <aside className="rail-column sticky top-13 hidden w-62 shrink-0 overflow-y-auto border-r border-rule bg-rail lg:block">
          <Rail groups={groups} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-12">
            {children}
          </main>
          <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-rule px-4 py-3 text-meta text-ink-3 md:px-8 xl:px-12">
            <span>Aletheia Government Operations</span>
            <span className="tnum">Build {build}</span>
            <span>{environment === "production" ? "Production" : environment === "staging" ? "Staging" : "Development"}</span>
            {footerNote ? <span className="ml-auto">{footerNote}</span> : null}
          </footer>
        </div>
      </div>
      <CommandPalette open={search} onClose={() => setSearch(false)} groups={groups} />
    </div>
  );
}
