import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

// Form controls (brief §13.3, §34). Every control sits in a Field with a visible label; hints
// and errors are linked by aria-describedby, and an error is stated in words, never by colour
// alone. Controls are 40 px tall (44 px on touch), with a 1 px warm border that meets 3:1.

const control =
  "block w-full rounded-sm border border-rule-control bg-sheet px-3 text-ui text-ink placeholder:text-ink-3 transition-colors duration-(--dur-quick) hover:border-ink-2 focus-visible:border-authority disabled:bg-sunken disabled:text-ink-3 aria-invalid:border-status-danger";

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-ui font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1.5 font-medium text-ink-3">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-meta text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-meta font-semibold text-status-danger">
          <ErrorGlyph />
          <span>{error}</span>
        </p>
      ) : null}
      {children}
    </div>
  );
}

function ErrorGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3.8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** aria-describedby for a control inside a Field. */
export function describedBy(id: string, opts: { hint?: unknown; error?: unknown }): string | undefined {
  const ids = [opts.hint ? `${id}-hint` : null, opts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function TextInput({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={cx(control, "h-10 pointer-coarse:h-11", className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea className={cx(control, "min-h-28 py-2.5 leading-6", className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select className={cx(control, "h-10 appearance-none pr-9 pointer-coarse:h-11", className)} aria-invalid={invalid || undefined} {...rest}>
        {children}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** Checkbox or radio with its label to the right; the whole row is the target. */
export function Choice({ type = "checkbox", label, hint, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { type?: "checkbox" | "radio"; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3 py-1 text-ui", rest.disabled && "cursor-not-allowed text-ink-3", className)}>
      <input
        type={type}
        className={cx("choice mt-0.5", type === "radio" ? "choice-radio" : "choice-check")}
        {...rest}
      />
      <span className="grid gap-0.5">
        <span className="font-medium text-ink">{label}</span>
        {hint ? <span className="text-meta text-ink-2">{hint}</span> : null}
      </span>
    </label>
  );
}

/** A switch for settings that take effect immediately (brief §13.3). */
export function Switch({ label, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-3 text-ui font-medium", className)}>
      <input
        type="checkbox"
        role="switch"
        className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-rule-control bg-sunken transition-colors duration-(--dur-base) before:absolute before:top-0.5 before:left-0.5 before:size-3.5 before:rounded-full before:bg-ink-2 before:transition-transform before:duration-(--dur-base) checked:border-authority checked:bg-authority checked:before:translate-x-4 checked:before:bg-sheet"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

/** Error summary at the top of a form, each error linked to its field (brief §34). */
export function ErrorSummary({ errors, title = "Check the form" }: { errors: { field: string; message: string }[]; title?: string }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" tabIndex={-1} className="border-l-2 border-status-danger bg-status-danger-tint px-4 py-3">
      <p className="text-ui font-bold text-status-danger">
        {title}: {errors.length === 1 ? "1 problem" : `${errors.length} problems`}
      </p>
      <ul className="mt-1.5 grid gap-1">
        {errors.map((e) => (
          <li key={e.field}>
            <a href={`#${e.field}`} className="text-ui font-medium text-status-danger underline underline-offset-2">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
