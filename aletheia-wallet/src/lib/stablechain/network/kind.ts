// Network kinds and their codes (spec Section 10, `crates/core/src/network.rs`). The byte value
// is hashed into every domain digest; the HRP only seeds the identifier checksum (ADR-062).

export const NETWORK_KINDS = ["mainnet", "private-validation", "devnet", "regtest"] as const;
export type NetworkKind = (typeof NETWORK_KINDS)[number];

const CODES: Record<NetworkKind, number> = { mainnet: 1, "private-validation": 2, devnet: 3, regtest: 4 };
const HRPS: Record<NetworkKind, string> = { mainnet: "al", "private-validation": "alt", devnet: "ald", regtest: "alr" };
const LABELS: Record<NetworkKind, string> = {
  mainnet: "Mainnet Beta",
  "private-validation": "Private validation",
  devnet: "Devnet",
  regtest: "Regtest",
};

export function networkCode(kind: NetworkKind): number {
  return CODES[kind];
}

export function networkHrp(kind: NetworkKind): string {
  return HRPS[kind];
}

/** The name people see. The node reports `mainnet`; the live chain is Mainnet Beta. */
export function networkLabel(kind: NetworkKind): string {
  return LABELS[kind];
}

export function parseNetworkKind(text: string): NetworkKind | null {
  return (NETWORK_KINDS as readonly string[]).includes(text) ? (text as NetworkKind) : null;
}

/** Test networks get the hatched rail band (wallet prompt 12.2). */
export function isTestNetwork(kind: NetworkKind): boolean {
  return kind !== "mainnet";
}
