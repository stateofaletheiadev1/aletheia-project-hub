// The network verification gate (wallet prompt 12.3; spec 41 "wallets MUST verify network and
// chain_id before signing"). A `VerifiedNetwork` can only be made here, and signing functions take
// one, so an unverified node cannot be signed for.

import type { BlockId } from "$lib/types/brand";
import { ChainError } from "../rpc/errors";
import type { ChainClient } from "../rpc/client";
import { ASSETS } from "../assets/assets";
import { parseBlockId } from "../addresses/identifiers";
import { parseNetworkKind, type NetworkKind } from "./kind";

declare const verified: unique symbol;

export interface ExpectedNetwork {
  readonly chainId: number;
  readonly kind: NetworkKind;
  /** Block 0 of the expected chain. Required on mainnet. */
  readonly genesisBlock: string | null;
  readonly protocolVersions: readonly number[];
}

export interface VerifiedNetwork {
  readonly [verified]: true;
  readonly chainId: number;
  readonly kind: NetworkKind;
  readonly protocolVersion: number;
  readonly genesisBlock: BlockId;
  readonly finalizedHeight: number;
  readonly syncing: boolean;
  readonly verifiedAt: number;
  readonly assets: { readonly AEY: { transferable: boolean }; readonly ALnT: { transferable: boolean } };
}

const wrong = (detail: string) => new ChainError({ kind: "WrongNetwork", detail });

export async function verifyNetwork(
  client: ChainClient,
  expected: ExpectedNetwork,
  now = Date.now(),
): Promise<VerifiedNetwork> {
  const [status, genesis, assets] = await Promise.all([
    client.networkStatus(),
    client.blockByHeight(0),
    client.assets(),
  ]);
  if (status.chainId !== expected.chainId)
    throw wrong(`node is chain ${status.chainId}; this wallet signs for chain ${expected.chainId}`);
  const kind = parseNetworkKind(status.network);
  if (kind !== expected.kind)
    throw wrong(`node is a ${status.network} network; this wallet signs for ${expected.kind}`);
  if (!expected.protocolVersions.includes(status.protocolVersion)) {
    throw wrong(
      `node speaks protocol ${status.protocolVersion}; this wallet understands ${expected.protocolVersions.join(", ")}`,
    );
  }
  let genesisBlock: BlockId;
  try {
    genesisBlock = parseBlockId(genesis.id, kind);
  } catch {
    throw new ChainError({ kind: "InvalidResponse", detail: "genesis block id is not canonical" });
  }
  if (genesis.height !== 0)
    throw new ChainError({ kind: "InvalidResponse", detail: "block 0 reported another height" });
  if (expected.genesisBlock !== null && genesisBlock !== expected.genesisBlock) {
    throw wrong(`node's genesis is ${genesisBlock}, expected ${expected.genesisBlock}`);
  }
  if (expected.kind === "mainnet" && expected.genesisBlock === null)
    throw wrong("no genesis block is pinned for mainnet");
  const facts: Record<string, { transferable: boolean }> = {};
  for (const spec of Object.values(ASSETS)) {
    const info = assets.find((asset) => asset.id === spec.id);
    if (!info) throw new ChainError({ kind: "InvalidResponse", detail: `the node does not list ${spec.code}` });
    if (info.name !== spec.code || info.decimals !== spec.decimals) {
      throw new ChainError({
        kind: "InvalidResponse",
        detail: `${spec.code} reported ${info.decimals} decimals, expected ${spec.decimals}`,
      });
    }
    facts[spec.code] = { transferable: info.transferable };
  }
  return {
    chainId: status.chainId,
    kind,
    protocolVersion: status.protocolVersion,
    genesisBlock,
    finalizedHeight: status.finalizedHeight,
    syncing: status.syncing,
    verifiedAt: now,
    assets: { AEY: facts.AEY!, ALnT: facts.ALnT! },
  } as VerifiedNetwork;
}

/** How old a verification may be when the user approves a transfer (wallet prompt 13.3). */
export const VERIFICATION_MAX_AGE_MS = 30_000;

export type SigningBlock = { reason: "stale"; ageMs: number } | { reason: "syncing" } | { reason: "mainnet-disabled" };

/** Why signing must not happen now, or null when it may. */
export function signingBlock(network: VerifiedNetwork, mainnetSigning: boolean, now = Date.now()): SigningBlock | null {
  if (network.kind === "mainnet" && !mainnetSigning) return { reason: "mainnet-disabled" };
  if (network.syncing) return { reason: "syncing" };
  const ageMs = now - network.verifiedAt;
  if (ageMs > VERIFICATION_MAX_AGE_MS || ageMs < 0) return { reason: "stale", ageMs };
  return null;
}
