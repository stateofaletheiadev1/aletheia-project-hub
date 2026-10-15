// Plain-language names for institutions and grants, used wherever access is shown.

import { CLASSIFICATION } from "./glossary";
import { INSTITUTION_SEED } from "./institutions";
import { ROLE_INFO, type Grant } from "@/policy/roles";

export function institutionName(slug: string): string {
  if (slug === "*") return "All institutions";
  return INSTITUTION_SEED.find((i) => i.slug === slug)?.name ?? slug;
}

export function grantLabel(g: Grant): string {
  return `${ROLE_INFO[g.role].label}, ${institutionName(g.institution)} (${CLASSIFICATION[g.clearance].label} clearance)`;
}

/** The role and institution shown under an official's name: their first grant. */
export function primaryTitle(grants: readonly Grant[]): { role: string; institution: string } {
  const g = grants[0];
  if (!g) return { role: "No role", institution: "No institution" };
  return { role: ROLE_INFO[g.role].label, institution: institutionName(g.institution) };
}
