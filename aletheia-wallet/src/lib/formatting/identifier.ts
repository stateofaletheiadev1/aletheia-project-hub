// Display grouping for identifiers (wallet prompt 5.4): readable chunks for the eye only; copying
// always yields the exact canonical string.

export interface IdentifierParts {
  readonly prefix: string;
  readonly groups: readonly string[];
}

export function identifierParts(value: string, groupSize = 4): IdentifierParts {
  const match = /^(alt:[TB]?)(.*)$/.exec(value);
  const prefix = match ? match[1]! : "";
  const body = match ? match[2]! : value;
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += groupSize) groups.push(body.slice(i, i + groupSize));
  return { prefix, groups };
}

/** First and last `keep` groups with an ellipsis between. */
export function middleEllipsis(value: string, keep = 2, groupSize = 4): { head: string; tail: string } {
  const { prefix, groups } = identifierParts(value, groupSize);
  if (groups.length <= keep * 2) return { head: value, tail: "" };
  return { head: prefix + groups.slice(0, keep).join(" "), tail: groups.slice(-keep).join(" ") };
}

/** For screen readers: the prefix, then groups separated by commas so they are read in chunks. */
export function spokenIdentifier(value: string): string {
  const { prefix, groups } = identifierParts(value);
  return `${prefix.replace(":", " ")} ${groups.join(", ")}`;
}
