import { createHash } from "node:crypto";

// The content hash of a published record (aletheia-ops ADR 0003). The workbench computes it, this
// site recomputes it and refuses a publication whose hash does not match. Both sides must use
// exactly this definition: SHA-256 (hex) of canonical JSON (sorted keys, no whitespace) of
// { register, reference, title, summary, body, facts, version }. Shared test vectors keep the two
// implementations in step (tests/unit/publication.test.ts here, content-hash.test.ts there).

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite number in canonical JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function publicationHash(p: {
  register: string;
  reference: string;
  title: string;
  summary: string;
  body: unknown;
  facts: unknown;
  version: number;
  positionType?: string;
  closingDate?: string;
}): string {
  // positionType and closingDate (opportunities) are omitted when absent, so other hashes are unchanged.
  const canonical = canonicalJson({
    register: p.register,
    reference: p.reference,
    title: p.title,
    summary: p.summary,
    body: p.body,
    facts: p.facts,
    version: p.version,
    positionType: p.positionType,
    closingDate: p.closingDate,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
