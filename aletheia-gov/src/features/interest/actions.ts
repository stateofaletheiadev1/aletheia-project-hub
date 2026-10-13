"use server";

import { headers } from "next/headers";
import { clientKey, createLimiter } from "@/server/security/rate-limit";
import { checkPdf } from "@/server/security/pdf";
import { registerInterest } from "@/server/services/interest";
import { CV_MAX_BYTES, InterestInput, type InterestState, type InterestValues } from "./schema";

// 5 registrations per hour per client address. In memory: correct for one server
// process (ADR 0004); a shared store is needed for multi-instance hosting.
const limiter = createLimiter({ limit: 5, windowMs: 3_600_000 });
const MIN_FILL_MS = 3_000;

export async function submitInterest(_prev: InterestState, form: FormData): Promise<InterestState> {
  const values: InterestValues = {
    fullName: String(form.get("fullName") ?? "").slice(0, 200),
    email: String(form.get("email") ?? "").slice(0, 200),
    positionTypes: form.getAll("positionTypes").map(String).slice(0, 10),
    institutions: form.getAll("institutions").map(String).slice(0, 40),
    expertise: String(form.get("expertise") ?? ""),
    note: String(form.get("note") ?? "").slice(0, 2000),
    consent: form.get("consent") === "on",
  };
  // Spam checks first: a hidden field humans never fill, and a minimum time on the form.
  if (String(form.get("website") ?? "") !== "") return { status: "saved", reference: "", positionTypes: [], institutions: [], cv: false };
  const startedAt = Number(form.get("startedAt"));
  if (startedAt && Date.now() - startedAt < MIN_FILL_MS) {
    return { status: "error", message: "That was very quick. Please check your details and send again.", fieldErrors: {}, values };
  }

  const verdict = limiter(clientKey(await headers()));
  if (!verdict.ok) {
    return { status: "error", message: `Too many registrations from your connection. Please try again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minutes.`, fieldErrors: {}, values };
  }

  const fieldErrors: Partial<Record<string, string>> = {};
  const parsed = InterestInput.safeParse({
    fullName: form.get("fullName") ?? "",
    email: form.get("email") ?? "",
    positionTypes: form.getAll("positionTypes").map(String),
    institutions: form.getAll("institutions").map(String),
    expertise: form.get("expertise") ?? "",
    note: form.get("note") ?? "",
    consent: form.get("consent") ?? undefined,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
  }

  // Required CV: judged by its bytes (PDF only, 2 MB), never by its name.
  let cv: { bytes: Uint8Array; name: string } | null = null;
  const file = form.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    fieldErrors.cv = "Attach your CV as a PDF";
  } else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkPdf(bytes, CV_MAX_BYTES);
    if (!check.ok) fieldErrors.cv = check.reason;
    else cv = { bytes, name: file.name };
  }

  if (!parsed.success || fieldErrors.cv) {
    return { status: "error", message: "Some details need attention.", fieldErrors, values };
  }

  const token = String(form.get("token") ?? "");
  const outcome = await registerInterest(parsed.data, cv, { idempotencyKey: /^[0-9a-f-]{36}$/.test(token) ? `interest-${token}` : undefined });
  if (!outcome.ok) {
    return {
      status: "error",
      message: outcome.reason === "not_configured" ? "Registration of interest is not open yet." : "The record is temporarily unavailable. Nothing was saved; please try again shortly.",
      fieldErrors: {},
      values,
    };
  }
  return { status: "saved", reference: outcome.reference, positionTypes: outcome.positionTypes, institutions: outcome.institutions, cv: outcome.cv };
}
