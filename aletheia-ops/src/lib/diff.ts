// Word-level difference between two texts, for the review view (brief §13.2 Review).
// Longest common subsequence over tokens (words and the whitespace between them). Texts in
// the workbench are paragraphs of a record, so inputs are small; the table is bounded anyway.

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

const MAX_CELLS = 4_000_000;

function tokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > MAX_CELLS) {
    // Too large to align word by word: show it as replaced, which is still truthful.
    return [
      ...(before ? [{ kind: "removed" as const, text: before }] : []),
      ...(after ? [{ kind: "added" as const, text: after }] : []),
    ];
  }
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = out.at(-1);
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]!);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push("removed", a[i++]!);
    } else {
      push("added", b[j++]!);
    }
  }
  while (i < n) push("removed", a[i++]!);
  while (j < m) push("added", b[j++]!);
  return out;
}

/** Pairs paragraphs of two versions by position, marking whole paragraphs added or removed. */
export function diffParagraphs(before: string[], after: string[]): { kind: "same" | "changed" | "added" | "removed"; parts: DiffPart[] }[] {
  const rows: { kind: "same" | "changed" | "added" | "removed"; parts: DiffPart[] }[] = [];
  const len = Math.max(before.length, after.length);
  for (let k = 0; k < len; k++) {
    const x = before[k];
    const y = after[k];
    if (x === undefined) rows.push({ kind: "added", parts: [{ kind: "added", text: y! }] });
    else if (y === undefined) rows.push({ kind: "removed", parts: [{ kind: "removed", text: x }] });
    else if (x === y) rows.push({ kind: "same", parts: [{ kind: "same", text: x }] });
    else rows.push({ kind: "changed", parts: diffWords(x, y) });
  }
  return rows;
}
