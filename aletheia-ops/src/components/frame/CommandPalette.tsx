"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { parseReference } from "@/domain/registers";
import { cx } from "@/lib/cx";
import type { NavGroup } from "./navigation";

// Global search (brief §33): Ctrl K or ⌘K. Pages the official can open are listed as they type;
// Enter searches the record on the server, which applies the same authorisation as everywhere
// else. An exact reference such as AGV-DEC-2026-0007 goes straight to its record.

export function CommandPalette({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: NavGroup[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ("");
      setCursor(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const options = useMemo(() => {
    const term = q.trim();
    const pages = groups
      .flatMap((g) => g.items.map((i) => ({ kind: "page" as const, href: i.href, label: i.label, group: g.label })))
      .filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 8);
    const search = term ? [{ kind: "search" as const, href: `/search?q=${encodeURIComponent(term)}`, label: parseReference(term) ? `Open ${term.toUpperCase()}` : `Search the record for “${term}”`, group: "Search" }] : [];
    return [...search, ...pages];
  }, [q, groups]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label="Search the record"
      className="dialog dialog-wide mx-auto mt-24 mb-auto rounded-md bg-sheet p-0 text-ink shadow-pop"
    >
      <div className="flex items-center gap-3 border-b border-rule px-4">
        <Search size={18} strokeWidth={1.5} aria-hidden className="text-ink-3" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-options"
          aria-activedescendant={options[cursor] ? `palette-${cursor}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && options[cursor]) {
              e.preventDefault();
              go(options[cursor].href);
            }
          }}
          placeholder="Reference, title or page"
          className="h-14 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3 focus-visible:outline-none"
          aria-label="Reference, title or page"
        />
        <kbd className="text-meta text-ink-3">Esc</kbd>
      </div>
      <ul id="palette-options" role="listbox" className="max-h-96 overflow-y-auto py-2">
        {options.length === 0 ? <li className="px-4 py-3 text-ui text-ink-3">No pages match. Press Enter to search the record.</li> : null}
        {options.map((o, i) => (
          <li
            key={o.href}
            id={`palette-${i}`}
            role="option"
            aria-selected={i === cursor}
            onMouseEnter={() => setCursor(i)}
            onClick={() => go(o.href)}
            className={cx("flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-ui", i === cursor ? "bg-authority-tint text-authority" : "text-ink")}
          >
            <span className="font-semibold">{o.label}</span>
            <span className="caps text-ink-3">{o.group}</span>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
