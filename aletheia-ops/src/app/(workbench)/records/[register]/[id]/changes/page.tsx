import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiffText } from "@/components/patterns/custody";
import { PageHeader, SectionMark } from "@/components/ui/feedback";
import { Timestamp } from "@/components/ui/Timestamp";
import { bodyParagraphs, factsToText } from "@/domain/content";
import { isRegister, REGISTER } from "@/domain/registers";
import { diffParagraphs, diffWords } from "@/lib/diff";
import { getRecord, versionsOf } from "@/services/records/records";
import { requireDeps } from "@/server/runtime";
import { requireOfficial } from "@/server/session";

// The review view (brief §13.2.5): what changed between the two latest versions, word by word.

export const metadata: Metadata = { title: "Changes between versions" };

export default async function ChangesPage({ params }: { params: Promise<{ register: string; id: string }> }) {
  const { register, id } = await params;
  if (!isRegister(register)) notFound();
  const { official, actor } = await requireOfficial();
  const d = await requireDeps();
  const r = await getRecord(d, actor, id);
  if (!r || r.register !== register) notFound();
  const [latest, previous] = await versionsOf(d, r.id);
  if (!latest || !previous) notFound();
  const rows = diffParagraphs(bodyParagraphs(previous.content.body), bodyParagraphs(latest.content.body));
  const changed = rows.filter((x) => x.kind !== "same").length;
  const title = diffWords(previous.content.title, latest.content.title);
  const summary = diffWords(previous.content.summary, latest.content.summary);
  const facts = diffWords(factsToText(previous.content.facts), factsToText(latest.content.facts));
  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <Link href={`/records/${register}/${r.id}`} className="text-meta font-semibold text-authority hover:underline">
        ← Back to the record
      </Link>
      <PageHeader
        overline={<SectionMark n="R">{REGISTER[register].label}</SectionMark>}
        title={`Version ${previous.number} to version ${latest.number}`}
        lede={changed === 0 && previous.content.title === latest.content.title ? "The text is unchanged; only details outside the text differ." : `${changed} ${changed === 1 ? "paragraph" : "paragraphs"} changed. Added text is underlined in green, removed text struck through in red.`}
        meta={
          <p className="text-meta text-ink-2">
            Version {latest.number} submitted <Timestamp at={latest.createdAt} mode="datetime" timeZone={official.timezone} />
          </p>
        }
      />
      <article className="grid gap-5 border border-rule bg-sheet px-5 py-8 md:px-10">
        <div>
          <p className="caps text-ink-3">Title</p>
          <DiffText parts={title} />
        </div>
        {previous.content.summary || latest.content.summary ? (
          <div>
            <p className="caps text-ink-3">Summary</p>
            <DiffText parts={summary} />
          </div>
        ) : null}
        <div className="grid gap-4 border-t border-rule pt-5">
          <p className="caps text-ink-3">Text</p>
          {rows.map((row, i) => (
            <div key={i} className={row.kind === "same" ? "text-ink-2" : "border-l-2 border-authority pl-4"}>
              <DiffText parts={row.parts} />
            </div>
          ))}
        </div>
        {previous.content.facts.length || latest.content.facts.length ? (
          <div className="border-t border-rule pt-5">
            <p className="caps text-ink-3">Facts</p>
            <div className="whitespace-pre-line">
              <DiffText parts={facts} />
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
