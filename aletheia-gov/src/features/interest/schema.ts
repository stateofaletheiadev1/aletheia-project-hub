import { z } from "zod";
import { institutions, type Institution } from "@/content/institutions";
import { POSITION_SLUGS } from "@/content/positions";

// Registrations of interest are open for every institution that is not suspended or archived:
// founding roles in the ones being set up, and other positions in any of them.
export const INTEREST_INSTITUTIONS = institutions.filter((i) => !["suspended", "archived"].includes(i.status));
export const ANY_INSTITUTION = "any";

/** Checklist groups, in the order the site presents the framework. */
export const INSTITUTION_GROUPS: { title: string; kinds: Institution["kind"][] }[] = [
  { title: "The founding body", kinds: ["Founding body"] },
  { title: "Legislature and review", kinds: ["Legislature", "Territorial chamber"] },
  { title: "Executive and judiciary", kinds: ["Executive", "Judiciary"] },
  { title: "Independent bodies", kinds: ["Independent body"] },
  { title: "Ministries", kinds: ["Ministry"] },
];

export const EXPERTISE = [
  "Law and governance",
  "Economics and finance",
  "Engineering and technology",
  "Maritime affairs",
  "Energy and infrastructure",
  "Health",
  "Education and research",
  "Public administration",
  "Communications",
  "Other",
] as const;

export const CV_MAX_BYTES = 2 * 1024 * 1024;

const slugs = [ANY_INSTITUTION, ...INTEREST_INSTITUTIONS.map((i) => i.slug)] as [string, ...string[]];

export const InterestInput = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(200),
  positionTypes: z
    .array(z.enum(POSITION_SLUGS, { error: "Choose kinds of position from the list" }))
    .min(1, "Choose at least one kind of position")
    .max(POSITION_SLUGS.length)
    .transform((list) => [...new Set(list)]),
  institutions: z
    .array(z.enum(slugs, { error: "Choose institutions from the list" }))
    .min(1, "Choose at least one institution, or “Any institution”")
    .max(slugs.length)
    .transform((list) => [...new Set(list)]),
  expertise: z.enum(EXPERTISE, { error: "Choose your main area of expertise" }),
  note: z.string().trim().max(1000, "Keep the note under 1000 characters").optional().default(""),
  consent: z.literal("on", { error: "Please confirm you agree to how your details are used" }),
});

export type InterestInput = z.infer<typeof InterestInput>;

/** What the person typed, returned after a failed submit so the form can be refilled. */
export type InterestValues = { fullName: string; email: string; positionTypes: string[]; institutions: string[]; expertise: string; note: string; consent: boolean };

export type InterestState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<keyof InterestInput | "cv", string>>; values?: InterestValues }
  | { status: "saved"; reference: string; positionTypes: string[]; institutions: string[]; cv: boolean };

export function institutionName(slug: string): string {
  if (slug === ANY_INSTITUTION) return "Any institution where I’d be most useful";
  return institutions.find((i) => i.slug === slug)?.name ?? slug;
}
