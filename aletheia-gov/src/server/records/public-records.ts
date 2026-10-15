import "server-only";
import { z } from "zod";
import { POSITION_SLUGS, type PositionType } from "@/content/positions";
import { database } from "@/server/aletheiadb/client";

// The single boundary between public pages and the public record (brief §8.2, §16).
// Every query here hard-codes `publication.state = "published"` and `visibility = "public"`,
// and records are parsed into a public shape: internal fields are never passed on.
// When AletheiaDB is not configured or not reachable, listings say so (`source`) and the
// pages render an honest empty or unavailable state; nothing is invented.

export type RecordKind = "opportunity" | "document" | "decision" | "dispatch" | "finance" | "appointment" | "event";

export const COLLECTION: Record<RecordKind, string> = {
  opportunity: "opportunities",
  document: "documents",
  decision: "decisions",
  dispatch: "dispatches",
  finance: "finance",
  appointment: "appointments",
  event: "events",
};

/** Structured content: no raw HTML is ever stored or rendered (brief §10.8). */
const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("quote"), text: z.string(), source: z.string().optional() }),
]);
export type Block = z.infer<typeof Block>;

const PublicRecordSchema = z.object({
  reference: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  issuer: z.string().optional(),
  status: z.string().optional(),
  /** Opportunities: the kind of position (content/positions.ts); absent means a founding role. */
  positionType: z.enum(POSITION_SLUGS).optional(),
  body: z.array(Block).default([]),
  facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  publication: z.object({ state: z.literal("published"), publishedAt: z.string() }),
  /** Set by publication from the operations workbench: the published version and its SHA-256. */
  version: z.number().int().optional(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  correctedAt: z.string().optional(),
  demo: z.boolean().optional(), // test records are never shown (toPublic)
});

export type PublicRecord = {
  reference: string;
  slug: string;
  title: string;
  summary?: string;
  issuer?: string;
  status?: string;
  positionType?: PositionType;
  body: Block[];
  facts: { label: string; value: string }[];
  publishedAt: string;
  version?: number;
  contentHash?: string;
  correctedAt?: string;
};

export type Source = "aletheiadb" | "not_configured" | "unavailable";

export type Listing = {
  kind: RecordKind;
  source: Source;
  items: PublicRecord[];
  total?: number;
};

const PUBLIC_ONLY = { "publication.state": "published", visibility: "public" } as const;

function toPublic(doc: unknown): PublicRecord | null {
  const parsed = PublicRecordSchema.safeParse(doc);
  if (!parsed.success) return null; // malformed records are skipped, never half-rendered
  const r = parsed.data;
  if (r.demo === true) return null; // the site shows real records only, never test data
  return {
    reference: r.reference,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    issuer: r.issuer,
    status: r.status,
    positionType: r.positionType,
    body: r.body,
    facts: r.facts,
    publishedAt: r.publication.publishedAt,
    version: r.version,
    contentHash: r.contentHash,
    correctedAt: r.correctedAt,
  };
}

export async function listPublished(kind: RecordKind, opts: { limit?: number; withTotal?: boolean } = {}): Promise<Listing> {
  const db = database();
  if (!db) return { kind, source: "not_configured", items: [] };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  try {
    const records = db.collection(COLLECTION[kind]);
    const [page, total] = await Promise.all([
      records.find(PUBLIC_ONLY, { sort: { "publication.publishedAt": -1 }, limit }),
      opts.withTotal ? records.count(PUBLIC_ONLY) : Promise.resolve(undefined),
    ]);
    return { kind, source: "aletheiadb", items: page.documents.map(toPublic).filter((r): r is PublicRecord => r !== null), total };
  } catch (e) {
    console.error(`public record unavailable (${kind}):`, (e as Error).message);
    return { kind, source: "unavailable", items: [] };
  }
}

export async function getPublished(kind: RecordKind, slug: string): Promise<PublicRecord | null | "unavailable"> {
  const db = database();
  if (!db) return null;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  try {
    const doc = await db.collection(COLLECTION[kind]).findOne({ ...PUBLIC_ONLY, slug });
    return doc ? toPublic(doc) : null;
  } catch (e) {
    console.error(`public record unavailable (${kind}/${slug}):`, (e as Error).message);
    return "unavailable";
  }
}

/** The most recent publication across all kinds, or null if nothing is published. */
export async function lastPublishedAt(): Promise<string | null> {
  const listings = await Promise.all((Object.keys(COLLECTION) as RecordKind[]).map((k) => listPublished(k, { limit: 1 })));
  const dates = listings.flatMap((l) => l.items.map((i) => i.publishedAt)).sort();
  return dates.at(-1) ?? null;
}
