// Native assets (spec 18.3). Decimals here are the expectation; the wallet asserts them against
// `getAssets` before it shows or signs any amount (wallet prompt 12.8).

export type AssetCode = "AEY" | "ALnT";

export interface AssetSpec {
  readonly code: AssetCode;
  readonly id: number;
  readonly decimals: number;
  readonly name: string;
  readonly baseUnit: string;
}

export const ASSETS: Record<AssetCode, AssetSpec> = {
  AEY: { code: "AEY", id: 1, decimals: 18, name: "Aletheian Guilder", baseUnit: "10⁻¹⁸ AEY" },
  ALnT: { code: "ALnT", id: 2, decimals: 3, name: "Aletheia Talent", baseUnit: "Mite" },
};

export const ASSET_CODES: readonly AssetCode[] = ["AEY", "ALnT"];

export function assetById(id: number): AssetSpec | null {
  return Object.values(ASSETS).find((asset) => asset.id === id) ?? null;
}

export function parseAssetCode(text: string): AssetCode | null {
  return text === "AEY" || text === "ALnT" ? text : null;
}
