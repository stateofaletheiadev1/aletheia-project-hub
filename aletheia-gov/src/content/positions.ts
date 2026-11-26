// The kinds of position the State recruits for. Founding roles set an institution up; the
// others are the positions institutions fill once they exist (and some before). Used by
// "Register your interest", the register of opportunities and the workbench.

export type PositionType = "founding" | "permanent" | "fixed-term" | "advisory" | "volunteer";

export const POSITION_TYPES: { slug: PositionType; name: string; description: string }[] = [
  { slug: "founding", name: "Founding roles", description: "Helping to set up an institution before it is functioning." },
  { slug: "permanent", name: "Permanent positions", description: "Ongoing posts in an institution's staff." },
  { slug: "fixed-term", name: "Fixed-term and contract roles", description: "Posts for a set period or a defined piece of work." },
  { slug: "advisory", name: "Advisory, board and expert roles", description: "Boards, councils, panels and specialist advice." },
  { slug: "volunteer", name: "Volunteer roles", description: "Unpaid contributions, alongside other work." },
];

export const POSITION_SLUGS = POSITION_TYPES.map((p) => p.slug) as [PositionType, ...PositionType[]];

/** Validator licence applications (aletheiagov.org/validator-licensing/apply) are kept with the
 * other applications under this kind. They have their own form, so the kind is not offered on
 * "Register your interest"; the staff area lists and filters it with the others. */
export const VALIDATOR_OPERATOR = "validator-operator";
export const RECORD_POSITION_TYPES: { slug: string; name: string }[] = [
  ...POSITION_TYPES,
  { slug: VALIDATOR_OPERATOR, name: "Validator operator licence" },
];
export const RECORD_POSITION_SLUGS = RECORD_POSITION_TYPES.map((p) => p.slug);

export function positionName(slug: string): string {
  return RECORD_POSITION_TYPES.find((p) => p.slug === slug)?.name ?? slug;
}
