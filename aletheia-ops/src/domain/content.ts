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

export type ContentProblem = { field: "title" | "summary" | "body" | "facts" | "sourceDocument"; message: string };

/** What must be true before a version can be submitted for review. */
export function contentProblems(c: Content, register: string): ContentProblem[] {
  const p: ContentProblem[] = [];
  if (c.title.trim().length < 10) p.push({ field: "title", message: "Give a title of at least 10 characters." });
  if (c.title.length > 240) p.push({ field: "title", message: "Keep the title under 240 characters." });
  if (c.summary.length > 600) p.push({ field: "summary", message: "Keep the summary under 600 characters." });
  if (c.body.length === 0) p.push({ field: "body", message: "Write the text of the record." });
  if (c.facts.some((f) => !f.label || !f.value)) p.push({ field: "facts", message: "Write each fact as “Label: value”." });
  if (register === "finance" && c.sourceDocument && !/^AGV-[A-Z]{3}-\d{4}-\d{4,}$/.test(c.sourceDocument)) {
    p.push({ field: "sourceDocument", message: "Give the source document as a reference, such as AGV-DOC-2026-0001." });
  }
  return p;
}
