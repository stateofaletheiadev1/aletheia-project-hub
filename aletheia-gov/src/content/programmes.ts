import type { InstitutionalStatus } from "@/lib/status";

// Structural content. Progress is derived from published milestones only (brief §10.5);
// none are published yet, so every programme says so. Listed in docs/content-review.md.

export type Programme = {
  slug: string;
  name: string;
  status: InstitutionalStatus;
  line: string;
  summary: string[];
  scope: string[];
  image: string | null;
  imageAlt?: string;
  illustrative?: boolean;
  lead: string;
  external?: { href: string; label: string };
  featured?: boolean;
};

export const programmes: Programme[] = [
  {
    slug: "founding-framework",
    name: "Constitutional and institutional framework",
    status: "in_development",
    featured: true,
    line: "Drafting the covenant, the institutions it creates, and the rules that bind them.",
    summary: [
      "The founding framework is the written design of the State: the constitution, the institutions, and the limits on each. A draft exists as the National Blueprint.",
      "The work now is to turn the draft into versioned documents with official references, so that every change is visible.",
    ],
    scope: ["Draft constitution", "Institutional design", "Status and accountability rules"],
    image: "library",
    imageAlt: "Shelves filled with bound books",
    lead: "The Founding Government",
  },
  {
    slug: "stablechain",
    name: "Aletheia StableChain",
    status: "in_development",
    featured: true,
    line: "The settlement ledger for the Aletheian Guilder and the public record.",
    summary: [
      "StableChain is the ledger on which the Aletheian Guilder (AEY) is to settle and against which public spending can be verified.",
      "The node software is being written now. A public network is not yet running.",
    ],
    scope: ["Node software", "Monetary layer for the AEY", "Public explorer"],
    image: "deep-water",
    imageAlt: "Light falling through deep blue water",
    lead: "Reserve Bank of Aletheia (proposed)",
    external: { href: "https://stateofaletheia.org/stablechain", label: "About StableChain on stateofaletheia.org" },
  },
  {
    slug: "government-platform",
    name: "Government platform",
    status: "in_development",
    featured: true,
    line: "This website and the workbench behind it: the public record and the tools to keep it.",
    summary: [
      "aletheiagov.org is the founding government's public record. The workbench behind it will let institutions draft, review and publish with two approvers on every privileged act.",
    ],
    scope: ["Public record", "Recruitment and applicant portal", "Government workbench"],
    image: "working-papers",
    imageAlt: "Two people working over notes and laptops",
    lead: "The Founding Government",
  },
  {
    slug: "aletheiadb",
    name: "AletheiaDB",
    status: "in_development",
    line: "A record database whose full history is kept, built for an accountable public record.",
    summary: [
      "AletheiaDB stores records with their complete history in version control, so the public record can be audited line by line. Personal data is encrypted before it is written.",
    ],
    scope: ["Storage engine", "Encrypted personal data", "Audit history"],
    image: null,
    lead: "The Founding Government",
  },
  {
    slug: "maritime-framework",
    name: "Maritime and ports framework",
    status: "proposed",
    featured: true,
    line: "Rules for waters, shipping registers and ports, prepared before there is a coast to govern.",
    summary: [
      "The draft framework sets out a maritime administration: a ship registry, port governance and fisheries rules. This programme will turn those outlines into draft law.",
      "Aletheia holds no waters or ports today.",
    ],
    scope: ["Ship registry design", "Port governance", "Fisheries and conservation rules"],
    image: "ship-at-sea",
    imageAlt: "A container ship under way at sea",
    illustrative: true,
    lead: "Ministry of Maritime Affairs and Ports (proposed)",
  },
  {
    slug: "energy-framework",
    name: "Energy and water framework",
    status: "proposed",
    featured: true,
    line: "A plan for clean generation and desalinated water, designed from first principles.",
    summary: [
      "The draft framework proposes offshore wind and desalination as the basis of energy and water supply. This programme will prepare the technical and legal framework.",
    ],
    scope: ["Generation mix", "Desalination", "Grid and tariff rules"],
    image: "offshore-wind",
    imageAlt: "Offshore wind turbines standing in open water",
    illustrative: true,
    lead: "Ministry of Infrastructure and Energy (proposed)",
  },
  {
    slug: "antioch-plan",
    name: "Plan for the capital, Antioch",
    status: "proposed",
    featured: true,
    line: "An urban plan for the proposed capital: radial avenues, concentric rings, civic quarter.",
    summary: [
      "Antioch is the proposed capital. The draft framework describes a city of six radial avenues and concentric rings around a civic quarter.",
      "It exists as a plan. Any drawing published here is a conceptual visualization, not an existing site.",
    ],
    scope: ["Urban plan", "Civic quarter", "Transport rings"],
    image: "drawings",
    imageAlt: "A person drawing on large architectural plans",
    lead: "The Founding Government",
  },
  {
    slug: "guilder-banknotes",
    name: "Aletheian Guilder banknote series",
    status: "planned",
    line: "The paper series of the AEY, alongside its StableChain form.",
    summary: [
      "The Aletheian Guilder is designed to exist in two forms: banknotes and StableChain. The banknote series is planned; no notes have been issued.",
    ],
    scope: ["Series design", "Security features", "Issuance rules"],
    image: null,
    lead: "Reserve Bank of Aletheia (proposed)",
    external: { href: "https://stateofaletheia.org/aey", label: "The Aletheian Guilder on stateofaletheia.org" },
  },
];

export const getProgramme = (slug: string) => programmes.find((p) => p.slug === slug);
export const featuredProgrammes = programmes.filter((p) => p.featured);
