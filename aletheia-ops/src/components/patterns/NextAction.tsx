"use client";

import { useState, useTransition } from "react";
import { cx } from "@/lib/cx";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/Dialog";

// The next action on a folio (brief §13.2 Folio, §23): the one primary button, any secondary
// steps, and a plain statement when the official has none. Every step opens a confirmation
// that names its consequence; the server decides again when it is confirmed.

export type StepOffer = {
  action: string;
  label: string;
  allowed: boolean;
  reasons?: string[];
  primary?: boolean;
  danger?: boolean;
  consequence: string;
  reasonLabel?: string;
  typeToConfirm?: string;
};

export function NextAction({
  offers,
  noneText,
  onStep,
}: {
  offers: StepOffer[];
  noneText: string;
  /** Server action; resolves to an error sentence or null. */
  onStep?: (action: string, reason?: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState<StepOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allowed = offers.filter((o) => o.allowed);
  const blocked = offers.filter((o) => !o.allowed);
  const primary = allowed.find((o) => o.primary) ?? null;
  const secondary = allowed.filter((o) => o !== primary);

  return (
    <section aria-labelledby="next-action" className="border border-rule bg-sheet p-4">
      <h2 id="next-action" className="caps text-ink-2">
        Your next action
      </h2>
      {allowed.length === 0 ? (
        <p className="mt-2 text-ui font-normal text-ink">{noneText}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {primary ? (
            <Button variant="primary" className="w-full" onClick={() => setOpen(primary)}>
              {primary.label}
            </Button>
          ) : null}
          {secondary.length ? (
            <div className="flex flex-wrap gap-2">
              {secondary.map((o) => (
                <Button key={o.action} variant={o.danger ? "quiet" : "secondary"} size="sm" className={cx("flex-1", o.danger && "text-status-danger hover:bg-status-danger-tint")} onClick={() => setOpen(o)}>
                  {o.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {blocked.length ? (
        <div className="mt-4 border-t border-rule pt-3">
          {blocked.map((o) => (
            <div key={o.action} className="mt-2 first:mt-0">
              <p className="text-meta font-semibold text-ink-2">{o.label}: not yet</p>
              <ul className="mt-0.5 grid gap-0.5">
                {o.reasons?.map((r) => (
                  <li key={r} className="text-meta text-ink-2">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-meta font-semibold text-status-danger">
          {error}
        </p>
      ) : null}
      {open ? (
        <ConfirmDialog
          open
          onClose={() => setOpen(null)}
          title={open.label}
          consequence={open.consequence}
          confirmLabel={open.label}
          variant={open.danger ? "danger" : "primary"}
          reasonLabel={open.reasonLabel}
          typeToConfirm={open.typeToConfirm}
          pending={pending}
          onConfirm={(reason) =>
            start(async () => {
              const err = onStep ? await onStep(open.action, reason) : null;
              setError(err);
              setOpen(null);
            })
          }
        />
      ) : null}
    </section>
  );
}
