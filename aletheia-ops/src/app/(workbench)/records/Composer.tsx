"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { RecordBody } from "@/components/patterns/RecordBody";
import { Button } from "@/components/ui/Button";
import { Choice, Field, Select, TextInput, Textarea } from "@/components/ui/form";
import { parseBody, parseFacts } from "@/domain/content";
import { formatTime } from "@/lib/time";
import { createAction, saveAction, type ComposerState } from "./actions";

// The composer (brief §13.2.4): a focused writing surface, metadata in a side panel, autosave
// with a visible time, a preview as the public portal will show it, and a guard against leaving
// with unsaved changes.

type Option = { value: string; label: string };

export function Composer({
  mode,
  register,
  noun,
  id,
  rev,
  institutions,
  classifications,
  initial,
  timeZone,
  backHref,
}: {
  mode: "new" | "edit";
  register: string;
  noun: string;
  id?: string;
  rev?: number;
  institutions: Option[];
  classifications: Option[];
  initial: { title: string; summary: string; body: string; facts: string; classification: string; institution?: string; sourceDocument?: string; disclosureAuthorised?: boolean };
  timeZone: string;
  backHref: string;
}) {
  const [state, action, pending] = useActionState<ComposerState, FormData>(mode === "new" ? createAction : saveAction, { rev });
  const [values, setValues] = useState(initial);
  // Each edit bumps a counter that is sent with the save; unsaved while they differ.
  const [edits, setEdits] = useState(0);
  const dirty = edits !== (state.mark ?? 0);
  const setDirty = () => setEdits((n) => n + 1);
  const [preview, setPreview] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const currentRev = state.rev ?? rev;

  // Autosave 15 seconds after the last change, while editing an existing draft.
  useEffect(() => {
    if (mode !== "edit" || !dirty || pending) return;
    const t = setTimeout(() => form.current?.requestSubmit(), 15_000);
    return () => clearTimeout(t);
  }, [values, dirty, pending, mode]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setDirty();
  };
  const body = useMemo(() => parseBody(values.body), [values.body]);
  const facts = useMemo(() => parseFacts(values.facts), [values.facts]);

  return (
    <form ref={form} action={action} className="grid gap-8 xl:grid-cols-12" noValidate>
      <input type="hidden" name="register" value={register} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="rev" value={currentRev ?? ""} />
      <input type="hidden" name="mark" value={edits} />

      <div className="grid content-start gap-6 xl:col-span-8">
        {state.error ? (
          <p role="alert" className="border-l-2 border-status-danger bg-status-danger-tint px-4 py-3 text-ui font-semibold text-status-danger">
            {state.error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-2">
          <div className="flex gap-1" role="tablist" aria-label="Composer view">
            {(["Write", "Preview"] as const).map((label) => {
              const on = (label === "Preview") === preview;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPreview(label === "Preview")}
                  className={on ? "rounded-xs bg-sheet px-3 py-1.5 text-ui font-semibold text-authority" : "rounded-xs px-3 py-1.5 text-ui font-medium text-ink-2 hover:text-ink"}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="text-meta text-ink-2">
            {pending ? "Saving…" : dirty ? "Unsaved changes" : state.savedAt ? `Saved ${formatTime(new Date(state.savedAt), timeZone)}` : mode === "edit" ? "No changes" : ""}
          </p>
        </div>

        {preview ? (
          <article className="border border-rule bg-sheet px-5 py-8 md:px-10" aria-label="Preview as on aletheiagov.org">
            <p className="caps text-ink-3">Preview, as it will appear on aletheiagov.org</p>
            <h1 className="mt-4 text-h1 text-ink text-balance">{values.title || "Untitled"}</h1>
            {values.summary ? <p className="mt-3 text-body text-ink-2 measure">{values.summary}</p> : null}
            <div className="prose-record measure mt-8">
              <RecordBody body={body} facts={facts} />
            </div>
          </article>
        ) : (
          <div className="grid gap-6">
            <Field id="title" label="Title" hint="Sentence case. As it will appear on the public record.">
              <TextInput id="title" name="title" value={values.title} onChange={set("title")} maxLength={240} required className="text-h3" />
            </Field>
            <Field id="summary" label="Summary" optional hint="One or two sentences shown in registers and search.">
              <Textarea id="summary" name="summary" value={values.summary} onChange={set("summary")} rows={2} maxLength={600} />
            </Field>
            <Field
              id="body"
              label="Text"
              hint={
                <>
                  Blank lines separate paragraphs. Start a line with <span className="font-semibold">## </span> for a heading, <span className="font-semibold">- </span> for a list item, or{" "}
                  <span className="font-semibold">&gt; </span> for a quotation.
                </>
              }
            >
              <Textarea id="body" name="body" value={values.body} onChange={set("body")} rows={18} className="text-body font-normal leading-7" />
            </Field>
          </div>
        )}
        {preview ? (
          <>
            <input type="hidden" name="title" value={values.title} />
            <input type="hidden" name="summary" value={values.summary} />
            <input type="hidden" name="body" value={values.body} />
          </>
        ) : null}
      </div>

      <aside className="grid content-start gap-6 border border-rule bg-sheet p-5 xl:col-span-4">
        <h2 className="caps text-ink-2">About this {noun}</h2>
        {mode === "new" ? (
          <Field id="institution" label="Institution">
            <Select id="institution" name="institution" value={values.institution} onChange={set("institution")}>
              {institutions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field id="classification" label="Classification" hint="Only Public records can be published.">
          <Select id="classification" name="classification" value={values.classification} onChange={set("classification")}>
            {classifications.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {register === "finance" ? (
          <Field id="sourceDocument" label="Source document" hint="The reference of the document this record is traced to. Required before submission.">
            <TextInput id="sourceDocument" name="sourceDocument" value={values.sourceDocument ?? ""} onChange={set("sourceDocument")} placeholder="AGV-DOC-2026-0001" className="tnum" />
          </Field>
        ) : null}
        {register === "appointments" ? (
          <Choice
            name="disclosureAuthorised"
            label="The appointee has agreed to publication of these details"
            hint="Required before publication. Name and position only; no other personal data."
            defaultChecked={values.disclosureAuthorised}
            onChange={() => setDirty()}
          />
        ) : null}
        <Field id="facts" label="Facts" optional hint="One per line, as “Label: value”. Shown beside the record on the portal.">
          <Textarea id="facts" name="facts" value={values.facts} onChange={set("facts")} rows={4} />
        </Field>
        <div className="grid gap-2 border-t border-rule pt-5">
          <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…">
            {mode === "new" ? `Create draft ${noun}` : "Save draft"}
          </Button>
          <Link href={backHref} className="text-center text-meta font-semibold text-authority hover:underline">
            {mode === "new" ? "Cancel" : "Back to the record"}
          </Link>
        </div>
      </aside>
    </form>
  );
}
