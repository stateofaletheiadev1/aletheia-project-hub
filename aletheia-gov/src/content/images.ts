import credits from "./credits.json";

export type ImageCredit = (typeof credits)[number];

export function imageFor(name: string): ImageCredit {
  const found = credits.find((c) => c.file === `/images/${name}.jpg`);
  if (!found) throw new Error(`Unknown image: ${name}`);
  return found;
}

export const allCredits = credits;
