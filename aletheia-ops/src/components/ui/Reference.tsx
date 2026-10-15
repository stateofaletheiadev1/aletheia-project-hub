"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

// An official reference (brief §9.2): Manrope 600, tabular figures, never wrapped, copied with
// one click. A reference not yet issued shows the portal's placeholder, which cannot be copied.

export function Reference({ value, href, className }: { value: string; href?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const placeholder = value.includes("·");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the reference stays selectable */
    }
  }

  if (placeholder) return <span className={cx("ref text-ink-3", className)}>{value}</span>;

  return (
    <span className={cx("group/ref inline-flex items-center gap-1", className)}>
      {href ? (
        <a href={href} className="ref text-ink hover:text-authority hover:underline hover:underline-offset-4">
          {value}
        </a>
      ) : (
        <span className="ref text-ink">{value}</span>
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex size-6 items-center justify-center rounded-xs text-ink-3 opacity-0 transition-opacity duration-(--dur-quick) group-hover/ref:opacity-100 hover:bg-authority-tint hover:text-authority focus-visible:opacity-100 pointer-coarse:opacity-100"
        aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
        title={copied ? "Copied" : "Copy reference"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          {copied ? (
            <path d="M3 7.2 5.8 10 11 4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          ) : (
            <>
              <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.5 4.5V3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v6a.5.5 0 0 0 .5.5h1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </>
          )}
        </svg>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Reference copied" : ""}
      </span>
    </span>
  );
}
