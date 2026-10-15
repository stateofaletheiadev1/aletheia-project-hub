import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

// Messages and absent states (brief §12.2, §13.3). Plain words: what happened or what is
// absent, why if known, and what to do next. Never "Something went wrong".

type AlertTone = "info" | "warning" | "danger" | "success";

const ALERT: Record<AlertTone, { bar: string; bg: string; title: string; glyph: ReactNode }> = {
  info: {
    bar: "border-authority",
    bg: "bg-authority-tint",
    title: "text-authority",
    glyph: (
      <>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7v4.2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      </>
    ),
  },
  warning: {
    bar: "border-status-returned",
    bg: "bg-status-returned-tint",
    title: "text-status-returned",
    glyph: (
      <>
        <path d="M8 1.8 14.6 13.6H1.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 6.2v3.6" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
      </>
    ),
  },
  danger: {
    bar: "border-status-danger",
    bg: "bg-status-danger-tint",
    title: "text-status-danger",
    glyph: (
      <>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
  success: {
    bar: "border-status-approved",
    bg: "bg-status-approved-tint",
    title: "text-status-approved",
    glyph: (
      <>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 8.2 7.1 10.3 11 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  },
};

export function InlineAlert({ tone = "info", title, children, action, className }: { tone?: AlertTone; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const s = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 border-l-2 px-4 py-3", s.bar, s.bg, className)}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={cx("mt-0.5 shrink-0", s.title)}>
        {s.glyph}
      </svg>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className={cx("text-ui font-bold", s.title)}>{title}</p>
        {children ? <div className="text-ui font-normal text-ink measure">{children}</div> : null}
        {action ? <div className="mt-1.5">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * An empty register in the portal's manner: ghost reference rows fading out, then a plain
 * statement of what is absent and why, and what will appear (brief §12.2).
 */
export function EmptyRegister({ placeholder, title, children, action }: { placeholder?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-10">
      {placeholder ? (
        <div aria-hidden className="mb-8 grid gap-0">
          {[100, 82, 60].map((w, i) => (
            <div key={w} className="flex h-10 items-center gap-6 border-b border-rule-faint" style={{ opacity: 1 - i * 0.28 }}>
              <span className="ref text-ink-3">{placeholder}</span>
              <span className="h-px bg-rule" style={{ width: `${w * 0.5}%` }} />
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-h3 font-semibold text-ink">{title}</p>
      {children ? <div className="mt-2 text-body font-normal text-ink-2 measure">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Shown in place of a page or panel the official may not see (brief §13.3). */
export function PermissionDenied({ what = "this page", children }: { what?: string; children?: ReactNode }) {
  return (
    <div className="py-16">
      <p className="caps text-ink-3">No access</p>
      <h1 className="mt-2 text-h2 text-ink">You do not have access to {what}.</h1>
      <div className="mt-3 text-body font-normal text-ink-2 measure">
        {children ?? <p>Access is granted per institution by its administrator. If your work needs it, ask them; the request and its outcome are recorded.</p>}
      </div>
    </div>
  );
}

/** A failure the official can act on. `reference` is the correlation id for support. */
export function ErrorState({ title, children, reference, action }: { title: string; children?: ReactNode; reference?: string; action?: ReactNode }) {
  return (
    <div className="py-16">
      <p className="caps text-status-danger">Not completed</p>
      <h1 className="mt-2 text-h2 text-ink">{title}</h1>
      {children ? <div className="mt-3 text-body font-normal text-ink-2 measure">{children}</div> : null}
      {reference ? (
        <p className="mt-4 text-meta text-ink-3">
          Correlation reference <span className="ref text-ink-2">{reference}</span>
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Placeholder rows for loads that take longer than 300 ms. No shimmer (brief §12.1). */
export function Skeleton({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-6 border-b border-rule-faint">
          <span className="h-2.5 w-36 rounded-xs bg-sunken" />
          <span className="h-2.5 flex-1 rounded-xs bg-sunken" style={{ maxWidth: `${70 - (i % 3) * 15}%` }} />
          <span className="h-2.5 w-20 rounded-xs bg-sunken" />
        </div>
      ))}
    </div>
  );
}

/** "§ 01  Requires your action" — the portal's section device, used with restraint. */
export function SectionMark({ n, children, className }: { n: string; children: ReactNode; className?: string }) {
  return (
    <p className={cx("section-mark caps", className)}>
      <span className="text-seal-ink">§ {n}</span>
      <span className="text-ink-2">{children}</span>
    </p>
  );
}

/** A page title block: caps, title, optional lede and actions aligned to the title. */
export function PageHeader({ caps, title, lede, actions, meta }: { caps?: ReactNode; title: string; lede?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-rule pb-6">
      <div className="min-w-0 max-w-3xl">
        {caps ? <div className="mb-2">{caps}</div> : null}
        <h1 className="text-h1 text-ink text-balance">{title}</h1>
        {lede ? <p className="mt-2 text-body font-normal text-ink-2 measure">{lede}</p> : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
