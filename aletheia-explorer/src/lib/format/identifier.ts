// Identifier display (spec 41A.3): we group, we do not mutilate.
//
// Full identifiers are shown in groups of four separated by a thin space that is not part
// of the copied text; components render each group as text and each gap as an unselectable
// span. In dense tables, the first 8 and last 6 characters are shown with a full-value
// tooltip. Copy always yields the exact canonical string.

const PREFIXES = ["AL:T", "AL:B", "AL:", "ALX"] as const;

export interface GroupedIdentifier {
  readonly prefix: string; // "AL:", "AL:T", "AL:B", "ALX" or ""
  readonly groups: readonly string[];
  readonly canonical: string; // exactly what copy yields
}

export function groupIdentifier(canonical: string): GroupedIdentifier {
  const prefix = PREFIXES.find((p) => canonical.startsWith(p)) ?? "";
  const body = canonical.slice(prefix.length);
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += 4) groups.push(body.slice(i, i + 4));
  return { prefix, groups, canonical };
}

/** Text with thin-space gaps, for contexts that cannot render separate spans (e.g. SVG). */
export function groupedText(canonical: string): string {
  const { prefix, groups } = groupIdentifier(canonical);
  return [prefix, ...groups].filter((part) => part !== "").join(" ");
}

export interface CompactIdentifier {
  readonly head: string;
  readonly tail: string;
  readonly canonical: string;
}

/** Dense-table form: the first 8 and last 6 characters; never used as the only display. */
export function compactIdentifier(canonical: string): CompactIdentifier {
  if (canonical.length <= 14) return { head: canonical, tail: "", canonical };
  return { head: canonical.slice(0, 8), tail: canonical.slice(-6), canonical };
}
