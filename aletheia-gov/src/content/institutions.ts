import type { InstitutionalStatus } from "@/lib/status";

// Structural content drawn from the National Blueprint (Edition 2026.3, draft).
// Every entry is listed in docs/content-review.md and needs human sign-off before launch.
// Nothing here names an officeholder: the directory shows published appointments only.

export type Institution = {
  slug: string;
  name: string;
  kind: "Founding body" | "Legislature" | "Territorial chamber" | "Executive" | "Judiciary" | "Independent body" | "Ministry";
  status: InstitutionalStatus;
  mandate: string;
  summary: string[];
  responsibilities: string[];
  basis: string;
  parent?: string;
  featured?: boolean;
  /** The institution's own website, where it has one. */
  website?: { href: string; label: string };
};

const BLUEPRINT = "National Blueprint, Edition 2026.3 (draft framework)";

export const institutions: Institution[] = [
  {
    slug: "founding-government",
    name: "The Founding Government",
    kind: "Founding body",
    status: "in_formation",
    featured: true,
    mandate: "Builds the institutions, infrastructure and public record of Aletheia before territory.",
    summary: [
      "The founding government is the body doing the work of building Aletheia now. It designs institutions, builds the infrastructure they will run on, recruits the people who will found them, and keeps a public record of what it decides and spends.",
      "It holds no territory and exercises no sovereign power. Its authority is limited to the work it publishes here, and it is accountable through that record.",
    ],
    responsibilities: [
      "Draft and maintain the founding constitutional and institutional framework",
      "Build the State's digital infrastructure: AletheiaChain, AletheiaDB and this platform",
      "Recruit founding contributors and keep a public register of appointments",
      "Publish decisions, documents and public-finance records with official references",
    ],
    basis: BLUEPRINT,
  },
  {
    slug: "covenant-assembly",
    name: "The Covenant Assembly",
    kind: "Legislature",
    status: "proposed",
    featured: true,
    mandate: "The primary legislative chamber: 61 members elected every four years.",
    summary: [
      "The framework proposes a single primary chamber of 61 members, elected every four years by open-list proportional representation across the capital district and the four states.",
      "No elections have been held and no members sit. The Assembly exists as a design in the draft framework.",
    ],
    responsibilities: ["Pass legislation", "Confirm the ministers", "Approve the budget", "Receive reports of the independent bodies"],
    basis: BLUEPRINT,
  },
  {
    slug: "council-of-the-states",
    name: "Council of States",
    kind: "Territorial chamber",
    status: "proposed",
    mandate: "A review chamber of 15 members with suspensive review of land, energy and currency acts.",
    summary: [
      "A territorial review chamber of 15 members: three elected by the citizens of each constituent state and three by the citizens of the capital district, for six-year terms.",
      "It may delay, but not block, ordinary acts, including those touching land, energy and currency. Its consent is needed for acts that change the powers or boundaries of the states.",
    ],
    responsibilities: ["Suspensive review of land, energy and currency acts", "Represent the states in federal legislation"],
    basis: BLUEPRINT,
  },
  {
    slug: "chancellery",
    name: "The Chancellor and Cabinet",
    kind: "Executive",
    status: "proposed",
    featured: true,
    mandate: "Executive authority, constitutionally capped at nine ministries.",
    summary: [
      "The Chancellor is to be elected directly by the citizens for a five-year term, at most twice, and leads a cabinet whose size is fixed by the constitution at no more than nine ministries.",
      "The cap is deliberate: it keeps the executive small, legible and expensive to expand.",
    ],
    responsibilities: ["Lead the executive", "Direct the nine ministries", "Answer to the Covenant Assembly"],
    basis: BLUEPRINT,
  },
  {
    slug: "high-court",
    name: "The High Court of Aletheia",
    kind: "Judiciary",
    status: "proposed",
    mandate: "Constitutional review, administrative review, and maritime and commercial disputes.",
    summary: [
      "The proposed judiciary is headed by a High Court of nine Justices serving single twelve-year terms. Below it sit a Court of Appeal, District Courts and a Court of Maritime and Commercial Disputes.",
    ],
    responsibilities: ["Constitutional review", "Administrative review of public bodies", "Maritime and commercial disputes"],
    basis: BLUEPRINT,
  },
  {
    slug: "auditor-general",
    name: "Office of the Auditor-General",
    kind: "Independent body",
    status: "proposed",
    featured: true,
    mandate: "Audits public spending and publishes verifiable proofs against the public ledger.",
    summary: [
      "An independent office reporting to the Covenant Assembly. Its task is to check that every public payment matches its authorisation, and to publish proofs anyone can verify against the AletheiaChain ledger.",
    ],
    responsibilities: ["Audit public accounts", "Publish verifiable proofs of spending", "Report to the Covenant Assembly"],
    basis: BLUEPRINT,
  },
  {
    slug: "monetary-authority",
    name: "Reserve Bank of Aletheia",
    kind: "Independent body",
    status: "proposed",
    featured: true,
    website: { href: "https://rba.aletheiagov.org", label: "rba.aletheiagov.org" },
    mandate: "Issues the Aletheian Guilder (AEY) under published rules, with monetary policy set by an independent Monetary Policy Committee.",
    summary: [
      "The Reserve Bank of Aletheia is to issue the Aletheian Guilder under published rules, and keep a public register of every issue. Its Monetary Policy Committee decides monetary policy independently of the government.",
      "It is deliberately separate from the Treasury: the body that issues money does not spend it, and may not lend to the State.",
      "No reserves, pegs, payment rails or banking relationships are operational. Any that become operational will be published here with evidence.",
    ],
    responsibilities: ["Issue the AEY under published rules", "Publish the issuance register", "Oversee payment systems, including the AletheiaChain monetary layer"],
    basis: BLUEPRINT,
  },
  {
    slug: "treasury",
    name: "Treasury and Public Finance",
    kind: "Independent body",
    status: "proposed",
    mandate: "Budgets, receipts and expenditure, kept separate from monetary issuance.",
    summary: [
      "The Treasury is to keep the State's budget, receipts and expenditure, and publish them as records with official references.",
      "Until a budget is adopted and published, this site shows no figures.",
    ],
    responsibilities: ["Prepare and publish budgets", "Record receipts and expenditure", "Publish procurement notices and reports"],
    basis: BLUEPRINT,
  },
  {
    slug: "electoral-commission",
    name: "Electoral Commission",
    kind: "Independent body",
    status: "proposed",
    mandate: "Will organise and certify elections to the Assembly and the State Councils.",
    summary: ["An independent commission to run and certify elections. No elections are scheduled."],
    responsibilities: ["Maintain the electoral register", "Run and certify elections", "Publish results"],
    basis: BLUEPRINT,
  },
  {
    slug: "registry-ombudsman",
    name: "Data Protection and Registry Ombudsman",
    kind: "Independent body",
    status: "proposed",
    mandate: "Keeps personal data off public ledgers and holds registries to account.",
    summary: [
      "An independent guardian of personal data. Its first rule is the separation of identity from public ledgers: no personal data on chain.",
    ],
    responsibilities: ["Audit registries", "Hear complaints about personal data", "Report to the Covenant Assembly"],
    basis: BLUEPRINT,
  },
  ...(
    [
      ["ministry-treasury-finance", "Ministry of Treasury and Finance", "Public accounts and fiscal policy."],
      ["ministry-digital-state", "Ministry of Digital State and Registries", "Digital government, the national registers, digital identity and e-residency."],
      ["ministry-security-civil-defence", "Ministry of Resilience and Civil Protection", "Civilian command of the ADSS, the police and civil protection."],
      ["ministry-health-social", "Ministry of Health and Social Well-being", "Public health, health care and social care."],
      ["ministry-education-science", "Ministry of Education and Science", "Schools, universities and research."],
      ["ministry-maritime-ports", "Ministry of Maritime Affairs, Ports and Environment", "Ports, shipping, the platforms, fisheries and the marine environment."],
      ["ministry-infrastructure-energy", "Ministry of Infrastructure and Energy", "Energy, water and transport networks."],
      ["ministry-foreign-affairs-justice", "Ministry of Foreign Affairs and Justice", "Diplomacy, treaties and the justice system."],
      ["ministry-agriculture-environment", "Ministry of Economy, Trade, Agriculture and Labour", "Economic and trade policy, food security and labour standards."],
    ] as const
  ).map(
    ([slug, name, mandate]): Institution => ({
      slug,
      name,
      kind: "Ministry",
      status: "proposed",
      mandate,
      summary: [`One of the nine ministries proposed in the draft framework. ${mandate}`],
      responsibilities: [],
      basis: BLUEPRINT,
      parent: "chancellery",
    }),
  ),
];

export const getInstitution = (slug: string) => institutions.find((i) => i.slug === slug);
export const topLevelInstitutions = institutions.filter((i) => !i.parent);
export const ministries = institutions.filter((i) => i.parent === "chancellery");
