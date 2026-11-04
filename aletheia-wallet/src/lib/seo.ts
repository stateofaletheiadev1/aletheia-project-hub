// Metadata for public pages (wallet prompt 17). Private routes never set this and are noindex.

export interface Seo {
  title: string;
  description: string;
  path: string;
}

export const PUBLIC_PAGES: readonly Seo[] = [
  {
    path: "/",
    title: "Aletheia Wallet — Official AletheiaChain Wallet",
    description:
      "The official AletheiaChain wallet. Securely manage native accounts, AEY and ALnT assets, and interact with the Aletheia blockchain.",
  },
  {
    path: "/about",
    title: "About · Aletheia Wallet",
    description:
      "The private ledger of the Sovereign Covenant State of Aletheia: a non-custodial wallet for AletheiaChain, held entirely in your hands.",
  },
  {
    path: "/security",
    title: "Security · Aletheia Wallet",
    description:
      "How Aletheia Wallet protects your keys: generated and sealed in your browser, verified against the network before every signature.",
  },
  {
    path: "/help",
    title: "Help · Aletheia Wallet",
    description:
      "Guidance for Aletheia Wallet: creating and restoring a wallet, sending and receiving AEY and ALnT, and reading the ledger.",
  },
  {
    path: "/network",
    title: "Network · Aletheia Wallet",
    description:
      "Live status of AletheiaChain as the wallet sees it: chain identity, latest finalized block and connection health.",
  },
];

export function seoFor(path: string): Seo {
  const found = PUBLIC_PAGES.find((page) => page.path === path);
  if (!found) throw new Error(`no public metadata for ${path}`);
  return found;
}
