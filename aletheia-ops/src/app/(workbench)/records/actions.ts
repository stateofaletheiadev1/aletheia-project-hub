"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBody, parseFacts, type Content } from "@/domain/content";
import { CLASSIFICATIONS } from "@/domain/glossary";
import { INSTITUTION_SEED } from "@/domain/institutions";
import { REGISTERS } from "@/domain/registers";
import { StoreConflict } from "@/ports/store";
import { Refused } from "@/services/identity/identity";
import { deliver } from "@/services/records/publication";
import { createDraft, saveDraft, step, STALE } from "@/services/records/records";
import { ACTIONS } from "@/workflow/types";
import { gateway, requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// Records (brief §18.3). Inputs are parsed with explicit schemas; the services decide again.

export type ComposerState = { error?: string; savedAt?: string; rev?: number; id?: string; mark?: number };

const Fields = z.object({
  title: z.string().max(240),
  summary: z.string().max(600),
  body: z.string().max(100_000),
  facts: z.string().max(5_000),
  classification: z.enum(CLASSIFICATIONS),
  sourceDocument: z.string().max(40).optional(),
  disclosureAuthorised: z.string().optional(),
});

function contentFrom(form: FormData): { content: Content; classification: (typeof CLASSIFICATIONS)[number] } | null {
  const f = Fields.safeParse({
    title: form.get("title") ?? "",
    summary: form.get("summary") ?? "",
    body: form.get("body") ?? "",
    facts: form.get("facts") ?? "",
    classification: form.get("classification"),
    sourceDocument: form.get("sourceDocument") || undefined,
    disclosureAuthorised: form.get("disclosureAuthorised") || undefined,
  });
  if (!f.success) return null;
  const c: Content = { title: f.data.title.trim(), summary: f.data.summary.trim(), body: parseBody(f.data.body), facts: parseFacts(f.data.facts) };
  if (f.data.sourceDocument?.trim()) c.sourceDocument = f.data.sourceDocument.trim().toUpperCase();
  if (f.data.disclosureAuthorised) c.disclosureAuthorised = true;
  return { content: c, classification: f.data.classification };
}

export async function createAction(_prev: ComposerState, form: FormData): Promise<ComposerState> {
  const signedIn = await requireOfficial();
  const register = z.enum(REGISTERS).safeParse(form.get("register"));
  const institution = z.enum(INSTITUTION_SEED.map((i) => i.slug) as [string, ...string[]]).safeParse(form.get("institution"));
  const parsed = contentFrom(form);
  if (!register.success || !institution.success || !parsed) return { error: "Choose an institution and a classification, and give the record a title." };
  let id: string;
  try {
    id = await createDraft(await requireDeps(), signedIn, { register: register.data, institution: institution.data, ...parsed });
  } catch (e) {
    if (e instanceof Refused) return { error: e.message };
    throw e;
  }
  redirect(`/records/${register.data}/${id}/edit?created=1`);
}

export async function saveAction(_prev: ComposerState, form: FormData): Promise<ComposerState> {
  const signedIn = await requireOfficial();
  const parsed = contentFrom(form);
  const rev = Number(form.get("rev"));
  const id = String(form.get("id"));
  if (!parsed || !Number.isInteger(rev)) return { error: "The form could not be read. Reload the page." };
  try {
    const next = await saveDraft(await requireDeps(), signedIn, id, rev, parsed.content, parsed.classification);
    revalidatePath(`/records/${form.get("register")}/${id}`);
    return { savedAt: new Date().toISOString(), rev: next, mark: Number(form.get("mark")) || 0 };
  } catch (e) {
    if (e instanceof Refused) return { error: e.message, rev, mark: -1 };
    throw e;
  }
}

/** One workflow step from the folio. Returns an error sentence, or null when done. */
export async function stepAction(recordId: string, register: string, rev: number, action: string, reason?: string): Promise<string | null> {
  const signedIn = await requireOfficial();
  const a = z.enum(ACTIONS).safeParse(action);
  if (!a.success) return "Unknown step.";
  const d = await requireDeps();
  try {
    const result = await step(d, signedIn, recordId, rev, a.data, reason);
    if (result.outboxId) {
      const g = gateway();
      if (g) await deliver(d, g, result.outboxId);
    }
  } catch (e) {
    if (e instanceof Refused) return e.message;
    if (e instanceof StoreConflict) return STALE;
    throw e;
  }
  revalidatePath(`/records/${register}/${recordId}`);
  revalidatePath("/queue");
  return null;
}
