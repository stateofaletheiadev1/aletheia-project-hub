import "server-only";

// The single boundary between public pages and the public record (brief §8.2, §16).
// Public rendering only ever sees records that are published AND public.
//
// AletheiaDB is not integrated yet (docs/database-integration.md). Until it is,
// every listing reports `source: "unavailable"` with no items. The pages render a
// designed empty state from that; nothing is ever invented or cached as fake data.

export type RecordKind = "opportunity" | "document" | "decision" | "dispatch" | "finance" | "appointment" | "event";

export type PublicRecord = {
  reference: string;
  slug: string;
  title: string;
  summary?: string;
  issuer?: string;
  publishedAt: string;
};

export type Listing = {
  kind: RecordKind;
  source: "aletheiadb" | "unavailable";
  items: PublicRecord[];
};

export async function listPublished(kind: RecordKind, opts: { limit?: number } = {}): Promise<Listing> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const items: PublicRecord[] = [];
  return { kind, source: "unavailable", items: items.slice(0, limit) };
}

/** The most recent publication across all kinds, or null if nothing is published. */
export async function lastPublishedAt(): Promise<string | null> {
  return null;
}
