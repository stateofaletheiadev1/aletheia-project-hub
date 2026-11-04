// Public configuration, fixed at build time by vite.config.ts (wallet prompt 12.2).

import { parseNetworkKind, type NetworkKind } from "$lib/stablechain/network/kind";
import type { ExpectedNetwork } from "$lib/stablechain/network/gate";

const raw = __WALLET_CONFIG__;
const kind: NetworkKind = parseNetworkKind(raw.network) ?? "mainnet";

export const config = {
  rpcUrl: raw.rpcUrl,
  restUrl: raw.restUrl,
  wsUrl: raw.wsUrl,
  explorerUrl: raw.explorerUrl.replace(/\/$/, ""),
  siteUrl: raw.siteUrl.replace(/\/$/, ""),
  buildHash: raw.buildHash,
  mainnetSigning: raw.mainnetSigning,
  network: kind,
  chainId: raw.chainId,
} as const;

export const expectedNetwork: ExpectedNetwork = {
  chainId: raw.chainId,
  kind,
  genesisBlock: raw.genesisBlock || null,
  protocolVersions: [1],
};

export const explorer = {
  tx: (id: string) => `${config.explorerUrl}/tx/${encodeURIComponent(id)}`,
  address: (address: string) => `${config.explorerUrl}/address/${encodeURIComponent(address)}`,
  block: (height: number) => `${config.explorerUrl}/blocks/${height}`,
  home: () => config.explorerUrl,
};
