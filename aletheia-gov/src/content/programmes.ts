import type { InstitutionalStatus } from "@/lib/status";

// Structural content. Progress is derived from published milestones only (brief §10.5): a
// milestone is listed only when it is complete and anyone can check its evidence (a live
// endpoint or a public commit). A programme is `operational` only with that evidence (§5.2).
// Listed in docs/content-review.md.

export type Milestone = {
  /** ISO date the milestone was completed. */
  date: string;
  title: string;
  evidence: { label: string; href: string };
};

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
  /** Required for `operational`: where the functioning system can be checked. */
  evidence?: string;
  milestones?: Milestone[];
};

const commit = (hash: string) => ({ label: `Commit ${hash}`, href: `https://github.com/stateofaletheiadev1/aletheia-project-hub/commit/${hash}` });

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
    slug: "aletheiachain",
    name: "AletheiaChain",
    status: "operational",
    evidence: "https://aletheiascan.mainnet.stateofaletheia.org/blocks/0",
    featured: true,
    line: "The settlement ledger for the Aletheian Guilder and the public record.",
    summary: [
      "AletheiaChain is Aletheia’s public ledger, the stablechain that holds its currencies. The Aletheian Guilder (AEY) settles on it, and public spending can be verified against it.",
      "It has run as Mainnet Beta, chain 7770, since 27 October 2026, producing a block every half second with deterministic finality. Its RPC, WebSocket subscriptions and public explorer are open to everyone; the Aletheia Wallet is its non-custodial wallet.",
    ],
    scope: ["Node software", "Monetary layer for the AEY", "Public RPC and WebSocket", "Public explorer"],
    milestones: [
      { date: "2026-10-27", title: "Mainnet Beta genesis: chain 7770, block 0", evidence: { label: "Block 0 on the explorer", href: "https://aletheiascan.mainnet.stateofaletheia.org/blocks/0" } },
      { date: "2026-10-27", title: "Public RPC, REST and JSON-RPC, at rpc.stateofaletheia.org", evidence: { label: "Live network status", href: "https://rpc.stateofaletheia.org/api/v1/network/status" } },
      { date: "2026-10-27", title: "Public explorer at aletheiascan.mainnet.stateofaletheia.org", evidence: { label: "The explorer", href: "https://aletheiascan.mainnet.stateofaletheia.org/" } },
      { date: "2026-11-04", title: "WebSocket subscriptions and account history on the public RPC", evidence: commit("089f9a6") },
    ],
    image: "deep-water",
    imageAlt: "Light falling through deep blue water",
    lead: "Reserve Bank of Aletheia (proposed)",
    external: { href: "https://stateofaletheia.org/aletheiachain", label: "About AletheiaChain on stateofaletheia.org" },
  },
  {
    slug: "government-platform",
    name: "Government platform",
    status: "operational",
    evidence: "https://ops.aletheiagov.org/",
    featured: true,
    line: "This website and the workbench behind it: the public record and the tools to keep it.",
    summary: [
      "aletheiagov.org is the founding government's public record. The Government Operations workbench at ops.aletheiagov.org is where officials draft, review and approve records; approved records are published here, signed, with every privileged act recorded in a hash-chained audit register.",
    ],
    scope: ["Public record", "Recruitment and applicant portal", "Government workbench"],
    image: "working-papers",
    imageAlt: "Two people working over notes and laptops",
    lead: "The Founding Government",
    milestones: [
      { date: "2026-10-09", title: "aletheiagov.org public record", evidence: commit("7de6080") },
      { date: "2026-10-15", title: "Government Operations workbench in production", evidence: commit("68e0b9c") },
      { date: "2026-10-15", title: "Approved records published from the workbench to aletheiagov.org", evidence: commit("5e34a24") },
    ],
  },
  {
    slug: "aletheiadb",
    name: "AletheiaDB",
    status: "operational",
    evidence: "https://db.stateofaletheia.org/health",
    line: "The State’s own record database, built for an accountable public record.",
    summary: [
      "AletheiaDB is the State’s own document database, written for Aletheia and running in production at db.stateofaletheia.org. It holds the records behind aletheiagov.org, the Government Operations workbench and the citizen portal. Personal data is encrypted before it is written.",
    ],
    scope: ["Storage engine", "Atomic commits", "Encrypted personal data", "Audit history"],
    image: null,
    lead: "The Founding Government",
    milestones: [
      { date: "2026-10-10", title: "AletheiaDB v1 in production at db.stateofaletheia.org", evidence: commit("a3786ec") },
      { date: "2026-10-15", title: "Atomic multi-record commits and append-only collections", evidence: commit("9972dfb") },
    ],
  },
  {
    slug: "aletheia-wallet",
    name: "Aletheia Wallet",
    status: "in_development",
    line: "The State’s non-custodial wallet for AletheiaChain: keys made and kept in the holder’s browser.",
    summary: [
      "Aletheia Wallet holds AEY and ALnT on AletheiaChain. The recovery phrase is generated and sealed in the holder’s browser and never leaves it; every transfer is priced by the network before it is signed and followed until the chain finalizes it.",
    ],
    scope: ["Key custody in the browser", "Transfers and receipts", "Live updates from the chain"],
    image: null,
    lead: "The Founding Government",
    milestones: [{ date: "2026-11-04", title: "Wallet built and verified against a live AletheiaChain node", evidence: commit("ba038e4") }],
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
    line: "The paper series of the AEY, alongside its AletheiaChain form.",
    summary: [
      "The Aletheian Guilder is designed to exist in two forms: banknotes and AletheiaChain. The banknote series is planned; no notes have been issued.",
    ],
    scope: ["Series design", "Security features", "Issuance rules"],
    image: null,
    lead: "Reserve Bank of Aletheia (proposed)",
    external: { href: "https://stateofaletheia.org/aey", label: "The Aletheian Guilder on stateofaletheia.org" },
  },
];

export const getProgramme = (slug: string) => programmes.find((p) => p.slug === slug);
export const featuredProgrammes = programmes.filter((p) => p.featured);
