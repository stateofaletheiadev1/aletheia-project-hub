"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button, type ButtonVariant } from "./Button";
import { Field, TextInput, Textarea } from "./form";

// Dialogs on the native <dialog> element: focus is contained, Escape closes, focus returns to
// the opener, the page behind is inert (brief §34, §35). No browser alert() or confirm().

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "dialog",
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** "panel" slides in from the right edge, for side panels attached to a record. */
  variant?: "dialog" | "panel";
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cx(
        "bg-sheet p-0 text-ink shadow-pop",
        variant === "dialog"
          ? cx("dialog m-auto rounded-md", wide ? "dialog-wide" : "dialog-narrow")
          : "panel mt-0 mr-0 mb-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-rule",
      )}
    >
      <div className={cx("flex flex-col", variant === "panel" && "h-full")}>
        <header className="flex items-start justify-between gap-4 border-b border-rule px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-ink">
              {title}
            </h2>
            {description ? (
              <div id={descId} className="mt-1 text-ui font-normal text-ink-2">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-2 hover:bg-sunken hover:text-ink"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="m3 3 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </header>
        {children ? <div className={cx("px-6 py-5", variant === "panel" && "flex-1 overflow-y-auto")}>{children}</div> : null}
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-rule bg-canvas px-6 py-4">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

/**
 * Confirmation that names the consequence (brief §34). With `reasonLabel` a reason is required;
 * with `typeToConfirm` the official types the reference before the action is enabled.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  consequence,
  confirmLabel,
  variant = "primary",
  reasonLabel,
  reasonHint,
  typeToConfirm,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  consequence: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  reasonLabel?: string;
  reasonHint?: string;
  typeToConfirm?: string;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const reasonId = useId();
  const typedId = useId();

  const reasonMissing = Boolean(reasonLabel) && reason.trim().length < 3;
  const typedWrong = Boolean(typeToConfirm) && typed.trim() !== typeToConfirm;

  function submit() {
    setTried(true);
    if (reasonMissing || typedWrong) return;
    onConfirm(reasonLabel ? reason.trim() : undefined);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} onClick={submit} pending={pending} pendingLabel="Recording…">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="text-body font-normal text-ink measure">{consequence}</div>
        {reasonLabel ? (
          <Field id={reasonId} label={reasonLabel} hint={reasonHint} error={tried && reasonMissing ? "Give a reason of at least a few words." : undefined}>
            <Textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} invalid={tried && reasonMissing} rows={4} />
          </Field>
        ) : null}
        {typeToConfirm ? (
          <Field
            id={typedId}
            label="Type the reference to confirm"
            hint={<span className="ref">{typeToConfirm}</span>}
            error={tried && typedWrong ? "The reference does not match." : undefined}
          >
            <TextInput id={typedId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} invalid={tried && typedWrong} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
