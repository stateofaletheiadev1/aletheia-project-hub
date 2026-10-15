// The ten institutions listed on aletheiagov.org (aletheia-gov/src/content/institutions.ts),
// with the portal's slugs, names, kinds and statuses as verified on 15 October 2026. They seed
// the institutions collection; once seeded, the database is the record (brief §18.4).

import type { InstitutionState } from "./glossary";

export type InstitutionSeed = { slug: string; name: string; shortName: string; kind: string; status: InstitutionState };

export const INSTITUTION_SEED: readonly InstitutionSeed[] = [
  { slug: "founding-government", name: "The Founding Government", shortName: "Founding Government", kind: "Founding body", status: "in_formation" },
  { slug: "covenant-assembly", name: "The Covenant Assembly", shortName: "Covenant Assembly", kind: "Legislature", status: "proposed" },
  { slug: "council-of-the-states", name: "Council of the States", shortName: "Council of the States", kind: "Territorial chamber", status: "proposed" },
  { slug: "chancellery", name: "The Chancellor and Cabinet", shortName: "Chancellery", kind: "Executive", status: "proposed" },
  { slug: "high-court", name: "The High Court of Aletheia", shortName: "High Court", kind: "Judiciary", status: "proposed" },
  { slug: "auditor-general", name: "Office of the Auditor-General", shortName: "Auditor-General", kind: "Independent body", status: "proposed" },
  { slug: "monetary-authority", name: "Aletheia Monetary Authority", shortName: "Monetary Authority", kind: "Independent body", status: "proposed" },
  { slug: "treasury", name: "Treasury and Public Finance", shortName: "Treasury", kind: "Independent body", status: "proposed" },
  { slug: "electoral-commission", name: "Electoral Commission", shortName: "Electoral Commission", kind: "Independent body", status: "proposed" },
  { slug: "registry-ombudsman", name: "Data Protection and Registry Ombudsman", shortName: "Registry Ombudsman", kind: "Independent body", status: "proposed" },
];
