"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { clientKey, createLimiter } from "@/server/security/rate-limit";
import { checkPdf } from "@/server/security/pdf";
import { registerValidatorApplication } from "@/server/services/interest";
import { mailConfigured, notifyAddress, sendMail } from "@/server/mail/mailer";
import { registrationNotice, registrationReceived } from "@/server/mail/templates";
import { PROFILE_MAX_BYTES, ValidatorInput, type ValidatorState, type ValidatorValues } from "./schema";

// 5 applications per hour per client address, in memory (ADR 0004), as for registrations.
const limiter = createLimiter({ limit: 5, windowMs: 3_600_000 });
const MIN_FILL_MS = 3_000;

const FIELDS = ["fullName", "email", "organisation", "country", "operatorAddress", "serverLocation", "hosting", "specs", "experience"] as const;

export async function submitValidatorApplication(_prev: ValidatorState, form: FormData): Promise<ValidatorState> {
  const text = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);
  const values = {
    ...(Object.fromEntries(FIELDS.map((f) => [f, text(f, f === "experience" ? 2000 : 500)])) as Record<(typeof FIELDS)[number], string>),
    consent: form.get("consent") === "on",
  } satisfies ValidatorValues;

  // Spam checks first: a hidden field humans never fill, and a minimum time on the form.
  if (text("website", 200) !== "") return { status: "saved", reference: "", profile: false };
  const startedAt = Number(form.get("startedAt"));
  if (startedAt && Date.now() - startedAt < MIN_FILL_MS) {
    return { status: "error", message: "That was very quick. Please check your details and send again.", fieldErrors: {}, values };
  }
  const verdict = limiter(clientKey(await headers()));
  if (!verdict.ok) {
    return { status: "error", message: `Too many applications from your connection. Please try again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minutes.`, fieldErrors: {}, values };
  }

  const fieldErrors: Partial<Record<string, string>> = {};
  const parsed = ValidatorInput.safeParse({ ...values, consent: form.get("consent") ?? undefined });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
  }

  // Optional organisation profile: judged by its bytes (PDF only, 2 MB), never by its name.
  let profile: { bytes: Uint8Array; name: string } | null = null;
  const file = form.get("profile");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkPdf(bytes, PROFILE_MAX_BYTES);
    if (!check.ok) fieldErrors.profile = check.reason;
    else profile = { bytes, name: file.name };
  }

  if (!parsed.success || fieldErrors.profile) {
    return { status: "error", message: "Some details need attention.", fieldErrors, values };
  }

  const token = text("token", 64);
  const outcome = await registerValidatorApplication(parsed.data, profile, {
    idempotencyKey: /^[0-9a-f-]{36}$/.test(token) ? `validator-${token}` : undefined,
  });
  if (!outcome.ok) {
    return {
      status: "error",
      message: outcome.reason === "not_configured" ? "Applications are not open yet." : "The record is temporarily unavailable. Nothing was saved; please try again shortly.",
      fieldErrors: {},
      values,
    };
  }
  if (mailConfigured()) {
    const data = parsed.data;
    const reference = outcome.reference;
    // After the response, so a slow mail server never holds up the person on the form.
    after(async () => {
      const summary = {
        fullName: data.fullName,
        email: data.email,
        reference,
        position: { title: "Validator operator licence", reference: "aletheiagov.org/validator-licensing" },
        institutions: [],
        positionTypes: [],
        validator: true,
      };
      await sendMail(registrationReceived(summary));
      await sendMail(registrationNotice(summary, notifyAddress()));
    });
  }
  return { status: "saved", reference: outcome.reference, profile: outcome.profile };
}
