// Branded types (wallet prompt 10.4): values are parsed at the boundary and never cast into
// these types anywhere else. Each brand has exactly one constructor, in the module that
// validates it.

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** `alt:` + 40 hex digits in the network's checksum casing. */
export type CanonicalAddress = Brand<string, "CanonicalAddress">;
/** `alt:T` + 64 hex digits. */
export type TxId = Brand<string, "TxId">;
/** `alt:B` + 64 hex digits. */
export type BlockId = Brand<string, "BlockId">;
/** An amount in an asset's smallest unit. */
export type BaseUnits = Brand<bigint, "BaseUnits">;
/** A decimal display string such as `125.5`, never a float. */
export type DecimalString = Brand<string, "DecimalString">;
export type ChainId = Brand<number, "ChainId">;
/** Exactly 32 bytes: a domain hash or signing digest. */
export type Digest32 = Brand<Uint8Array, "Digest32">;

export function assertNever(value: never, context = "value"): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
