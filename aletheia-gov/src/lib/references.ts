// Official public references: AGV-{TYPE}-{YEAR}-{SEQ} (brief §6.5.1).
// Generated server-side only; this module formats and validates them.
export const REFERENCE_TYPES = ["DOC", "DEC", "OPP", "APP", "DSP", "FIN", "APT", "EVT", "INS", "PRJ"] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

const PATTERN = /^AGV-(DOC|DEC|OPP|APP|DSP|FIN|APT|EVT|INS|PRJ)-(\d{4})-(\d{4,})$/;

export function formatReference(type: ReferenceType, year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError("year out of range");
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError("sequence must be a positive integer");
  return `AGV-${type}-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseReference(ref: string): { type: ReferenceType; year: number; seq: number } | null {
  const m = PATTERN.exec(ref);
  if (!m) return null;
  return { type: m[1] as ReferenceType, year: Number(m[2]), seq: Number(m[3]) };
}
