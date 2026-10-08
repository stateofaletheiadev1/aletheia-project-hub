import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/** Sections the footer names that are not open yet: what each will show, in one place. */
const SECTIONS: Record<string, { eyebrow: string; title: string; will: string[] }> = {
  governance: {
    eyebrow: "Consensus & Staking",
    title: "Governance",
    will: [
      "The council and its threshold, and every proposal with its votes, timelock and outcome.",
      "Parameter changes and protocol upgrades, from proposal to activation height.",
    ],
  },
  network: {
    eyebrow: "Consensus & Staking",
    title: "Network Analytics",
    will: [
      "Finality latency over the last day, validator participation and missed slots.",
      "Transactions per hour, fees paid and execution units used, as charts with their data tables.",
    ],
  },
  land: {
    eyebrow: "Sovereign Services",
    title: "Land Registry",
    will: [
      "Parcels and their full, readable history of transfers, with the land authority's co-signatures.",
    ],
  },
  identity: {
    eyebrow: "Sovereign Services",
    title: "Identity & Residence",
    will: [
      "Registered issuers and the credentials they publish, with revocation status. Personal data never appears: it is not on chain.",
    ],
  },
  bridge: {
    eyebrow: "Assets & Payments",
    title: "Cross-Chain Bridge",
    will: [
      "Routes as timetables: remote chain, status, limits and current use.",
      "Transfers out and in with both sides' confirmations, delayed and flagged messages, and bridge escrow.",
    ],
  },
  payments: {
    eyebrow: "Assets & Payments",
    title: "Payment Network",
    will: [
      "Settlement volume by scheme and by hour, and the participant directory.",
      "Lookup by UETR, hashed in your browser, showing the on-chain leg and its escrow state.",
    ],
  },
  contracts: {
    eyebrow: "Assets & Payments",
    title: "Arno Contracts",
    will: ["Deployed contracts with their verified source, calls, and the events they emit."],
  },
  docs: {
    eyebrow: "Protocol Resources",
    title: "Developer Docs",
    will: ["The RPC reference (REST and JSON-RPC), the wallet and CLI guides, and the Arno language guide."],
  },
  security: {
    eyebrow: "Protocol Resources",
    title: "Security Policy",
    will: ["How to report a vulnerability, what is in scope, and how disclosures are handled."],
  },
};

export const load: PageLoad = ({ params }) => {
  const section = SECTIONS[params.slug];
  if (!section) error(404, { message: "No such section", hint: "The sections are listed in the footer of every page." });
  return section;
};
