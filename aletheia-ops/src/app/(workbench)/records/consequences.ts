// What each step does, said before it is taken (brief §13.2.6, §34: confirmations name the
// consequence). Used by the folio's next-action panel.

import { REGISTER, type Register } from "@/domain/registers";
import type { Action } from "@/workflow/types";

export function consequence(action: Action, register: Register, ctx: { version?: number; reference?: string }): string {
  const noun = REGISTER[register].noun;
  const v = ctx.version ? `version ${ctx.version}` : "this version";
  switch (action) {
    case "submit":
      return `The current text is frozen as a new version and sent for review. You cannot edit it while it is under review.`;
    case "take_for_review":
      return `You take responsibility for examining ${v}. Others see that you are reviewing it.`;
    case "request_revision":
      return `The ${noun} returns to its author with your reasons. A revised version must be reviewed and approved again.`;
    case "reject":
      return `The ${noun} is closed with your reasons, and its author is told. It can only be reopened under policy.`;
    case "adopt":
      return `You record that the decision was adopted. A second officer must then approve ${v}.`;
    case "verify":
      return `You confirm the appointment has been checked. An approving officer must then approve ${v}.`;
    case "approve":
      return `Your approval is recorded against ${v} and its content hash. It does not make the ${noun} public.`;
    case "authorise_publication":
      return ctx.reference
        ? `You authorise ${ctx.reference} for release to the public record.`
        : `You authorise release to the public record. A permanent reference in the ${REGISTER[register].label} register is issued now and can never change.`;
    case "publish":
      return `This will appear on aletheiagov.org under ${REGISTER[register].label}${ctx.reference ? ` as ${ctx.reference}` : ""}. It is confirmed only when the portal answers.`;
    case "retry_publication":
      return `The same publication is sent again, under the same key, so it cannot appear twice.`;
    case "start_correction":
      return `A corrected version will go through review again. The published version stays public until the correction is released.`;
    case "withdraw":
      return `The ${noun} is withdrawn before publication, with your reason. This cannot be undone.`;
    case "archive":
      return `The ${noun} is closed and kept for the record.`;
    case "reopen":
      return `The ${noun} returns to draft for its author.`;
    default:
      return "";
  }
}

export const NEEDS_REASON: Action[] = ["request_revision", "reject", "withdraw", "start_correction", "reopen"];
export const DANGER: Action[] = ["reject", "withdraw"];
export const PRIMARY_ORDER: Action[] = ["submit", "take_for_review", "adopt", "verify", "approve", "authorise_publication", "publish", "retry_publication", "start_correction", "archive"];
