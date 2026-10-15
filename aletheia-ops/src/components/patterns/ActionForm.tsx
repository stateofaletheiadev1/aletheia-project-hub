"use client";

import { useActionState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button, type ButtonVariant } from "../ui/Button";

// A form bound to a server action, with its outcome stated in words beside the button and
// announced to screen readers. The outcome also lands in the audit register; this is only
// the immediate feedback (brief §12.1: never the only record).

export type ActionResult = { error?: string; done?: string };

export function ActionForm({
  action,
  submit,
  pendingLabel = "Recording…",
  variant = "secondary",
  size = "md",
  children,
  className,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  submit: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  children?: ReactNode;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={cx("grid gap-4", className)} noValidate>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} size={size} pending={pending} pendingLabel={pendingLabel}>
          {submit}
        </Button>
        <p role="status" aria-live="polite" className={cx("text-meta", state.error ? "font-semibold text-status-danger" : "font-semibold text-status-approved")}>
          {state.error ?? state.done ?? ""}
        </p>
      </div>
    </form>
  );
}
