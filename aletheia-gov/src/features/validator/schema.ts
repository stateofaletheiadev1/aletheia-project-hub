import { z } from "zod";

// What an applicant for a validator operator licence tells the government. Personal and
// organisational details are encrypted with the applicant's key before they are stored; the
// node's public keys are given later, on the chain, when the operator registers the node.

export const PROFILE_MAX_BYTES = 2 * 1024 * 1024;

export const HOSTING = ["Dedicated server", "Cloud virtual machine", "Own data centre", "Other"] as const;

export const ValidatorInput = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(200),
  organisation: z.string().trim().max(160, "Keep the organisation's name under 160 characters").optional().default(""),
  country: z.string().trim().min(2, "Enter the country you operate from").max(80, "Country is too long"),
  operatorAddress: z
    .string()
    .trim()
    .regex(/^alt:[0-9a-fA-F]{40}$/, { error: "Enter your AletheiaChain account address (alt: followed by 40 hexadecimal characters)" }),
  serverLocation: z.string().trim().min(2, "Enter where the server is (city and country)").max(120, "Location is too long"),
  hosting: z.enum(HOSTING, { error: "Choose how the server is hosted" }),
  specs: z.string().trim().min(5, "Describe the server: CPUs, memory and storage").max(400, "Keep the description under 400 characters"),
  experience: z.string().trim().min(20, "Tell us about your experience running servers or nodes").max(1500, "Keep this under 1500 characters"),
  consent: z.literal("on", { error: "Please confirm you agree to how your details are used" }),
});

export type ValidatorInput = z.infer<typeof ValidatorInput>;

/** What the person typed, returned after a failed submit so the form can be refilled. */
export type ValidatorValues = Omit<Record<keyof ValidatorInput, string>, "consent"> & { consent: boolean };

export type ValidatorState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<keyof ValidatorInput | "profile", string>>; values?: ValidatorValues }
  | { status: "saved"; reference: string; profile: boolean };
