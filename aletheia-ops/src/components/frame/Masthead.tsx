"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search, X } from "lucide-react";
import { Mark } from "../brand/Mark";
import type { NavGroup } from "./navigation";
import { Rail } from "./Rail";

// The masthead (brief §13.1): a slim navy band, as on the portal. The mark and name; a plain
// environment marker outside production; search (Ctrl K); notifications; the signed-in official
// with name, role and institution. Under 1024 px the rail moves into a drawer from here.

export type MastheadOfficial = { name: string; role: string; institution: string };

export function Masthead({
  official,
  environment,
  unread,
  groups,
  onSearch,
}: {
  official: MastheadOfficial;
  environment: "production" | "staging" | "development";
  unread: number;
  groups: NavGroup[];
  onSearch?: () => void;
}) {
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (drawer && !d.open) d.showModal();
    if (!drawer && d.open) d.close();
  }, [drawer]);

  return (
    <header className="on-navy sticky top-0 z-30 bg-masthead text-ink-inverse">
      <div className="flex h-13 items-center gap-3 px-3 lg:px-5">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-sm text-ink-inverse-2 hover:bg-rule-inverse hover:text-ink-inverse lg:hidden"
          aria-label="Open the menu"
          onClick={() => setDrawer(true)}
        >
          <Menu size={20} strokeWidth={1.5} aria-hidden />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Mark size={20} className="hidden sm:block" />
          <span className="grid leading-none">
            <span className="caps hidden text-seal-on-navy sm:block">Government of Aletheia</span>
            <span className="text-ui font-semibold tracking-wide text-ink-inverse">Operations</span>
          </span>
        </Link>

        {environment !== "production" ? (
          <span className="caps ml-1 rounded-xs bg-status-returned-tint px-1.5 py-0.5 text-status-returned" title="Not the production system. Nothing here is the public record.">
            {environment === "staging" ? "Staging" : (
              <>
                <span className="sm:hidden">Dev</span>
                <span className="hidden sm:inline">Development</span>
              </>
            )}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onSearch}
            className="hidden h-9 items-center gap-2.5 rounded-sm border border-rule-inverse px-3 text-ui text-ink-inverse-2 hover:border-ink-inverse-2 hover:text-ink-inverse md:inline-flex"
          >
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <span>Search the record</span>
            <kbd className="ml-4 font-sans text-meta text-ink-inverse-2">Ctrl K</kbd>
          </button>
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex size-10 items-center justify-center rounded-sm text-ink-inverse-2 hover:bg-rule-inverse md:hidden"
            aria-label="Search the record"
          >
            <Search size={20} strokeWidth={1.5} aria-hidden />
          </button>

          <Link
            href="/notifications"
            className="relative inline-flex size-10 items-center justify-center rounded-sm text-ink-inverse-2 hover:bg-rule-inverse hover:text-ink-inverse"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Bell size={20} strokeWidth={1.5} aria-hidden />
            {unread ? (
              <span className="tnum absolute top-1.5 right-1 min-w-4 rounded-full bg-seal px-1 text-center text-overline font-bold text-masthead">{unread > 99 ? "99+" : unread}</span>
            ) : null}
          </Link>

          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-3 rounded-sm pr-2 pl-3 hover:bg-rule-inverse">
              <span className="hidden text-right leading-tight xl:grid">
                <span className="text-ui font-semibold text-ink-inverse">{official.name}</span>
                <span className="max-w-72 truncate text-meta text-ink-inverse-2">
                  {official.role}, {official.institution}
                </span>
              </span>
              <span className="flex size-7 items-center justify-center rounded-full border border-ink-inverse-2 text-meta font-semibold text-ink-inverse" aria-hidden>
                {initials(official.name)}
              </span>
              <span className="sr-only">Account menu for {official.name}</span>
            </summary>
            <div className="absolute top-full right-0 z-40 mt-1 w-72 rounded-md border border-rule bg-sheet py-2 text-ink shadow-pop">
              <div className="border-b border-rule px-4 pt-1 pb-3">
                <p className="text-ui font-semibold">{official.name}</p>
                <p className="text-meta text-ink-2">
                  {official.role}, {official.institution}
                </p>
              </div>
              <ul className="py-1">
                {[
                  ["/account", "Profile"],
                  ["/account/security", "Security and authenticator"],
                  ["/settings/notifications", "Notification preferences"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link href={href!} className="block px-4 py-2 text-ui hover:bg-sunken">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <form action="/sign-out" method="post" className="border-t border-rule pt-1">
                <button type="submit" className="block w-full px-4 py-2 text-left text-ui font-semibold text-authority hover:bg-sunken">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>

      <dialog ref={drawerRef} onClose={() => setDrawer(false)} className="panel m-0 h-dvh max-h-dvh w-80 max-w-full bg-rail p-0 text-ink" aria-label="Menu">
        <div className="flex h-13 items-center justify-between bg-masthead px-3 text-ink-inverse">
          <span className="flex items-center gap-3 pl-1">
            <Mark size={20} />
            <span className="text-ui font-semibold">Operations</span>
          </span>
          <button type="button" onClick={() => setDrawer(false)} className="inline-flex size-10 items-center justify-center rounded-sm hover:bg-rule-inverse" aria-label="Close the menu">
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <Rail groups={groups} onNavigate={() => setDrawer(false)} />
      </dialog>
    </header>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
