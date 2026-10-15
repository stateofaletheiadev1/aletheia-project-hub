import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

// Buttons (brief §13.3). Variants:
//   primary   — the one next action on a view (navy). Only one per view.
//   secondary — alternative actions (outlined).
//   quiet     — low-emphasis actions inside panels and tables (text only).
//   danger    — destructive or irreversible actions (brick); always behind a confirmation.
// Labels say what they do, with the object: "Approve decision", never "OK" (brief §15).
// States: hover, focus-visible (2 px navy ring), active, disabled, pending (label changes).

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold transition-colors duration-(--dur-quick) ease-standard select-none disabled:opacity-55 aria-disabled:opacity-55 pointer-coarse:min-h-11";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-authority text-ink-inverse hover:bg-authority-hover active:bg-authority",
  secondary: "border border-rule-control bg-sheet text-authority hover:border-authority hover:bg-authority-tint",
  quiet: "text-authority hover:bg-authority-tint",
  danger: "bg-status-danger text-ink-on-solid hover:bg-status-danger-hover",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-ui",
  sm: "h-8 px-3 text-meta",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string): string {
  return cx(base, variants[variant], sizes[size], variant === "quiet" && size === "md" && "px-3", className);
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; className?: string };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  pending,
  pendingLabel,
  children,
  type = "button",
  ...rest
}: Common & ComponentProps<"button"> & { pending?: boolean; pendingLabel?: string }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={rest.disabled || pending} aria-busy={pending || undefined} {...rest}>
      {icon}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}

export function ButtonLink({ variant = "secondary", size = "md", icon, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
