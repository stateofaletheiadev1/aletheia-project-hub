"use client";

import Link from "next/link";

// Degraded mode (brief §21): composed and honest, never a stack trace.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="sea flex min-h-[88vh] items-center">
      <div className="shell pb-24 pt-[calc(var(--header-h)+5rem)]">
        <p className="section-mark t-meta text-gold-400">Temporarily unavailable</p>
        <h1 id="page-title" tabIndex={-1} className="t-display mt-10 max-w-[16ch] text-parchment-50 outline-none">
          The public record is temporarily unavailable.
        </h1>
        <p className="mt-8 max-w-[48ch] text-[1.0625rem] leading-relaxed text-parchment-300">
          Nothing has been lost. Please try again in a moment.
        </p>
        <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t rule pt-8 text-[1rem] font-semibold">
          <button type="button" onClick={reset} className="draw-link text-gold-300">
            Try again
          </button>
          <Link href="/" className="draw-link text-parchment-100">
            The front page
          </Link>
        </div>
      </div>
    </section>
  );
}
