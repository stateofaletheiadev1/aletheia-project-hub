// Record content (brief §18.3). The same structured blocks as the public portal
// (aletheia-gov/src/server/records/public-records.ts): no HTML is ever stored or rendered.
// The composer writes plain text with a deliberately small set of conventions:
//   ## Heading          - list item          > quotation
// Blank lines separate paragraphs.

import { z } from "zod";

export const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("quote"), text: z.string(), source: z.string().optional() }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const FactSchema = z.object({ label: z.string(), value: z.string() });

/** Kinds of position, as on aletheiagov.org (aletheia-gov/src/content/positions.ts). */
export const POSITION_TYPES = [
  { slug: "founding", name: "Founding role" },
  { slug: "permanent", name: "Permanent position" },
  { slug: "fixed-term", name: "Fixed-term or contract role" },
  { slug: "advisory", name: "Advisory, board or expert role" },
  { slug: "volunteer", name: "Volunteer role" },
] as const;
export type PositionType = (typeof POSITION_TYPES)[number]["slug"];
export const POSITION_SLUGS = POSITION_TYPES.map((p) => p.slug) as [PositionType, ...PositionType[]];
export type Fact = z.infer<typeof FactSchema>;

/** What an author writes. Hashed and frozen into a version on submission. */
export const ContentSchema = z.object({
  title: z.string(),
  summary: z.string(),
  body: z.array(BlockSchema),
  facts: z.array(FactSchema),
  /** Finance: the reference of the document this record is traced to. */
  sourceDocument: z.string().optional(),
  /** Appointments: the appointee has agreed to publication of the details given. */
  disclosureAuthorised: z.boolean().optional(),
  /** Opportunities: the kind of position, and the last day applications are taken (YYYY-MM-DD). */
  positionType: z.enum(POSITION_SLUGS).optional(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type Content = z.infer<typeof ContentSchema>;

export const EMPTY_CONTENT: Content = { title: "", summary: "", body: [], facts: [] };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseBody(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      blocks.push({ type: "list", items: lines.map((l) => clean(l.replace(/^\s*[-•]\s+/, ""))) });
    } else if (lines.length === 1 && /^\s*#{1,3}\s+/.test(lines[0]!)) {
      blocks.push({ type: "heading", text: clean(lines[0]!.replace(/^\s*#{1,3}\s+/, "")) });
    } else if (lines.every((l) => /^\s*>/.test(l))) {
      blocks.push({ type: "quote", text: clean(lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ")) });
    } else {
      blocks.push({ type: "paragraph", text: clean(lines.join(" ")) });
    }
  }
  return blocks;
}

export function bodyToText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "heading" ? `## ${b.text}` : b.type === "list" ? b.items.map((i) => `- ${i}`).join("\n") : b.type === "quote" ? `> ${b.text}` : b.text))
    .join("\n\n");
}

/** "Label: value" per line. */
export function parseFacts(text: string): Fact[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      return i > 0 ? { label: clean(l.slice(0, i)), value: clean(l.slice(i + 1)) } : { label: clean(l), value: "" };
    });
}

export function factsToText(facts: Fact[]): string {
  return facts.map((f) => `${f.label}: ${f.value}`).join("\n");
}

/** Plain paragraphs of a body, for the review diff. */
export function bodyParagraphs(blocks: Block[]): string[] {
  return blocks.map((b) => (b.type === "heading" ? `## ${b.text}` : b.type === "list" ? b.items.map((i) => `- ${i}`).join(" ") : b.type === "quote" ? `> ${b.text}` : b.text));
}

export type ContentProblem = { field: "title" | "summary" | "body" | "facts" | "sourceDocument" | "positionType" | "closingDate"; message: string };

/** What must be true before a version can be submitted for review. */
export function contentProblems(c: Content, register: string): ContentProblem[] {
  const p: ContentProblem[] = [];
  if (c.title.trim().length < 3) p.push({ field: "title", message: "Give the record a title." });
  if (c.title.length > 240) p.push({ field: "title", message: "Keep the title under 240 characters." });
  if (c.summary.length > 600) p.push({ field: "summary", message: "Keep the summary under 600 characters." });
  if (c.body.length === 0) p.push({ field: "body", message: "Write the text of the record." });
  if (c.facts.some((f) => !f.label || !f.value)) p.push({ field: "facts", message: "Write each fact as “Label: value”." });
  if (register === "finance" && c.sourceDocument && !/^AGV-[A-Z]{3}-\d{4}-\d{4,}$/.test(c.sourceDocument)) {
    p.push({ field: "sourceDocument", message: "Give the source document as a reference, such as AGV-DOC-2026-0001." });
  }
  if (register === "opportunities") {
    if (!c.positionType) p.push({ field: "positionType", message: "Choose the kind of position." });
    if (!c.closingDate || Number.isNaN(Date.parse(`${c.closingDate}T00:00:00Z`))) p.push({ field: "closingDate", message: "Give the closing date for applications." });
  }
  return p;
}
