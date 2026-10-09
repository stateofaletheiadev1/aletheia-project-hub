"use client";

import { useEffect, useRef, useState } from "react";

// A horizontal editorial rail: native scroll with snap, plus quiet previous/next controls.
// Works fully without JavaScript (it is just a scrollable list).
export function Rail({ children, label, count }: { children: React.ReactNode; label: string; count: number }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0");
      setIndex(Math.min(count - 1, Math.round(el.scrollLeft / step)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (first.getBoundingClientRect().width + 32), behavior: reduce ? "auto" : "smooth" });
  };

  const btn =
    "flex h-11 w-11 items-center justify-center border border-[var(--rule-ledger)] text-navy-800 transition-colors duration-[var(--dur-quick)] hover:border-navy-800 hover:bg-navy-800 hover:text-parchment-50 disabled:pointer-events-none disabled:opacity-35";

  return (
    <div>
      <div className="shell flex items-center justify-end gap-5">
        <p className="t-ref text-ink-600" aria-live="polite">
          {String(index + 1).padStart(2, "0")} <span className="text-parchment-500">/</span> {String(count).padStart(2, "0")}
        </p>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => go(-1)} disabled={index === 0} aria-label="Previous programme">
            <span aria-hidden>←</span>
          </button>
          <button type="button" className={btn} onClick={() => go(1)} disabled={index >= count - 1} aria-label="Next programme">
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
      <ul
        ref={track}
        aria-label={label}
        className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2 xl:scroll-px-[max(var(--gutter),calc((100vw-1440px)/2+var(--gutter)))] xl:px-[max(var(--gutter),calc((100vw-1440px)/2+var(--gutter)))]"
      >
        {children}
      </ul>
    </div>
  );
}
