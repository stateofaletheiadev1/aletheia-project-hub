import Link from "next/link";
import type { ReactNode } from "react";
import { specimenBody, specimenBodyPrevious, specimenNow } from "@fixtures/specimens";
import { Pagination } from "@/components/patterns/Pagination";
import { AttachmentRow, DiffText, PublicationReceipt, Stepper } from "@/components/patterns/custody";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyRegister, ErrorState, InlineAlert, PageHeader, PermissionDenied, SectionMark, Skeleton } from "@/components/ui/feedback";
import { Choice, ErrorSummary, Field, Select, Switch, TextInput, Textarea } from "@/components/ui/form";
import { Reference } from "@/components/ui/Reference";
import { ClassificationTag, PriorityMark, StatusTag } from "@/components/ui/tags";
import { Timestamp } from "@/components/ui/Timestamp";
import { CLASSIFICATIONS, PRIORITIES, RECORD_STATES } from "@/domain/glossary";
import { diffParagraphs } from "@/lib/diff";
import { DialogDemo } from "./DialogDemo";

// The component reference (brief §13.3): every component in every state, with real-length text.

function Specimen({ n, title, children, note }: { n: string; title: string; children: ReactNode; note?: string }) {
  return (
    <section className="grid gap-5 border-t border-rule-strong pt-5 xl:grid-cols-12 xl:gap-10">
      <div className="xl:col-span-3">
        <SectionMark n={n}>{title}</SectionMark>
        {note ? <p className="mt-2 text-meta text-ink-2">{note}</p> : null}
      </div>
      <div className="min-w-0 xl:col-span-9">{children}</div>
    </section>
  );
}

export default function DesignReference() {
  const diff = diffParagraphs(specimenBodyPrevious, specimenBody);
  return (
    <div className="mx-auto grid max-w-7xl gap-14">
      <PageHeader
        caps={<SectionMark n="00">Design reference</SectionMark>}
        title="Aletheia Operations design system"
        lede="Every component in every state, set in Manrope with the colours of the public portal. The archetypes show the components in use."
        actions={
          <>
            <ButtonLink href="/design/briefing">Briefing</ButtonLink>
            <ButtonLink href="/design/register">Register</ButtonLink>
            <ButtonLink href="/design/folio" variant="primary">
              Folio
            </ButtonLink>
          </>
        }
      />

      <Specimen n="01" title="Type" note="Manrope only. No italic. Tabular figures in data.">
        <div className="grid gap-4">
          <p className="text-display text-ink">Thursday 15 October 2026</p>
          <p className="text-h1 text-ink">Decisions of the Council of the States</p>
          <p className="text-h2 text-ink">Requires your action</p>
          <p className="text-h3 text-ink">Countersignatures on version 3</p>
          <p className="text-body font-normal text-ink measure">
            Decisions are published only once adopted and approved by a second officer. Every version is kept, and every published version carries a SHA-256 content hash.
          </p>
          <p className="text-ui text-ink">Interface text at 14 px for tables, forms and navigation.</p>
          <p className="text-meta text-ink-2">Metadata · 15 Oct 2026, 15:42 WAT</p>
          <p className="caps text-ink-2">Overline label</p>
          <p className="ref text-ink">AGV-DEC-2026-0007 · AGV-FIN-2026-0112</p>
          <p className="tnum text-ui text-ink">0123456789 · 1,482,112 · 88.06</p>
        </div>
      </Specimen>

      <Specimen n="02" title="Buttons" note="One primary per view. Labels say what they do.">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Approve decision</Button>
            <Button>Request revision</Button>
            <Button variant="quiet">Add a comment</Button>
            <Button variant="danger">Withdraw decision</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" pending pendingLabel="Recording approval…">
              Approve decision
            </Button>
            <Button disabled>Submit for review</Button>
            <Button size="sm">Take for review</Button>
            <Button size="sm" variant="quiet">
              Copy link
            </Button>
          </div>
        </div>
      </Specimen>

      <Specimen n="03" title="Status" note="A glyph for every status, readable in greyscale.">
        <div className="flex flex-wrap gap-2">
          {RECORD_STATES.map((s) => (
            <StatusTag key={s} state={s} />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {CLASSIFICATIONS.map((c) => (
            <ClassificationTag key={c} value={c} />
          ))}
          <span className="mx-2 h-4 w-px bg-rule" />
          {PRIORITIES.map((p) => (
            <PriorityMark key={p} value={p} />
          ))}
        </div>
      </Specimen>

      <Specimen n="04" title="References and time" note="Click to copy. Hover a time for the absolute value.">
        <div className="grid gap-3 text-ui">
          <p className="flex flex-wrap items-center gap-6">
            <Reference value="AGV-DEC-2026-0007" />
            <Reference value="AGV-DOC-2026-0003" href="https://www.aletheiagov.org/documents" />
            <Reference value="AGV-DEC-····-····" />
          </p>
          <p className="flex flex-wrap gap-6 text-ink-2">
            <Timestamp at="2026-10-15T14:30:00Z" now={specimenNow} />
            <Timestamp at="2026-10-14T09:00:00Z" now={specimenNow} />
            <Timestamp at="2026-10-15T14:30:00Z" mode="datetime" />
            <Timestamp at="2026-10-15T14:30:00Z" mode="time" timeZone="Europe/London" />
          </p>
        </div>
      </Specimen>

      <Specimen n="05" title="Forms" note="Errors in words, summarised and linked.">
        <div className="grid max-w-2xl gap-6">
          <ErrorSummary
            errors={[
              { field: "f-title", message: "Enter a title of at least 10 characters" },
              { field: "f-source", message: "Link the source document this finance record is drawn from" },
            ]}
          />
          <Field id="f-title" label="Title" hint="As it will appear on aletheiagov.org. Sentence case." error="Enter a title of at least 10 characters">
            <TextInput id="f-title" defaultValue="Budget" invalid aria-describedby="f-title-hint f-title-error" />
          </Field>
          <Field id="f-inst" label="Owning institution">
            <Select id="f-inst" defaultValue="registry-ombudsman">
              <option value="registry-ombudsman">Data Protection and Registry Ombudsman</option>
              <option value="treasury">Treasury and Public Finance</option>
            </Select>
          </Field>
          <Field id="f-source" label="Source document" optional hint="The reference of the document this record is traced to.">
            <TextInput id="f-source" placeholder="AGV-DOC-2026-0001" />
          </Field>
          <Field id="f-summary" label="Summary">
            <Textarea id="f-summary" defaultValue="A statement of the budget for the first quarter of the founding period, with the sources of each figure." />
          </Field>
          <fieldset className="grid gap-1">
            <legend className="mb-1.5 text-ui font-semibold text-ink">Classification</legend>
            <Choice type="radio" name="c" label="Public" hint="May be published once approved and authorised." defaultChecked />
            <Choice type="radio" name="c" label="Restricted" hint="Only officers with restricted access to the institution." />
            <Choice type="radio" name="c" label="Confidential" disabled hint="You are not cleared to classify records as confidential." />
          </fieldset>
          <Choice label="Include in the homepage preview of the portal" hint="Only where the register supports it." />
          <Switch label="Compact registers" />
        </div>
      </Specimen>

      <Specimen n="06" title="Alerts">
        <div className="grid gap-3">
          <InlineAlert title="Approval recorded on version 3">The decision is ready for a publishing officer. It is not yet public.</InlineAlert>
          <InlineAlert tone="warning" title="This record changed while you were reviewing it">
            Tobias Aldridge saved version 4 at 15:38 WAT. Review the changes and try again.
          </InlineAlert>
          <InlineAlert tone="danger" title="The portal refused this publication">
            The content hash did not match the submitted text. Nothing was published. Correlation reference 01JA7Z3K9Q.
          </InlineAlert>
          <InlineAlert tone="success" title="Published to the public record as AGV-DOC-2026-0003" />
        </div>
      </Specimen>

      <Specimen n="07" title="Custody" note="Stages, receipt, attachments.">
        <div className="grid gap-8 md:grid-cols-2">
          <Stepper
            stages={[
              { state: "draft", status: "done", actor: "Tobias Aldridge", at: "2026-10-13T09:12:00Z" },
              { state: "submitted", status: "done", actor: "Tobias Aldridge", at: "2026-10-13T09:40:00Z" },
              { state: "under_review", status: "current", actor: "Ilse van der Westhuizen" },
              { state: "approved", status: "upcoming" },
              { state: "published", status: "upcoming" },
            ]}
          />
          <div className="grid content-start gap-6">
            <PublicationReceipt
              r={{
                reference: "AGV-DOC-2026-0003",
                url: "https://www.aletheiagov.org/documents/registry-ombudsman-framework",
                publishedAt: "2026-10-14T12:41:00Z",
                contentHash: "3b1f0e6c9a24d8b7e5c3a1f9d7b5e3c1a9f7d5b3e1c9a7f5d3b1e9c7a5f3d1b9",
              }}
            />
            <PublicationReceipt
              r={{ reference: "AGV-DSP-2026-0001", url: "", publishedAt: "2026-10-15T09:00:00Z", contentHash: "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00", simulated: true }}
            />
          </div>
        </div>
        <div className="mt-6 max-w-xl">
          <AttachmentRow a={{ id: "1", name: "Statement of contributions received, founding programme, first quarter 2026 (signed).pdf", type: "pdf", bytes: 2_104_532, scan: "clean" }} />
          <AttachmentRow a={{ id: "2", name: "Ledger extract.xlsx", type: "xlsx", bytes: 40_960, scan: "unscanned" }} />
          <AttachmentRow a={{ id: "3", name: "invoice.pdf", type: "pdf", bytes: 512, scan: "infected" }} />
        </div>
      </Specimen>

      <Specimen n="08" title="Changes between versions" note="Version 2 to version 3.">
        <div className="grid max-w-3xl gap-4 border border-rule bg-sheet p-6">
          {diff.map((row, i) => (
            <div key={i} className={row.kind === "same" ? "text-ink-2" : undefined}>
              <DiffText parts={row.parts} />
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen n="09" title="Dialogs" note="Consequence first. Typed confirmation for what cannot be undone.">
        <DialogDemo />
      </Specimen>

      <Specimen n="10" title="Absence and failure">
        <div className="grid gap-2 divide-y divide-rule">
          <EmptyRegister placeholder="AGV-DEC-····-····" title="No decisions yet.">
            <p>Decisions are published only once adopted and approved by a second officer.</p>
          </EmptyRegister>
          <PermissionDenied what="the restricted records of the Treasury" />
          <ErrorState
            title="The record could not be saved"
            reference="01JA7Z3K9Q4M"
            action={
              <Link href="/design" className="link font-semibold">
                Return to the register
              </Link>
            }
          >
            <p>The database did not answer within 15 seconds. Your text is kept in this window; try saving again in a moment.</p>
          </ErrorState>
          <div className="py-8">
            <Skeleton rows={4} label="Loading the register" />
          </div>
          <div className="py-8">
            <Pagination page={2} pageSize={25} total={132} href={(p) => `/design?page=${p}`} />
          </div>
        </div>
      </Specimen>
    </div>
  );
}
