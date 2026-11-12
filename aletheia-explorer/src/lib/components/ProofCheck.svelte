<script lang="ts">
  // Checks a balance in the visitor's browser (node ADR-065): the state key is derived here from
  // the address and asset, and the Merkle proof is recomputed up to the state root of the block
  // it names. Nothing about the result is taken from the server's word.
  import { verifyStateProof, ProofError } from "$sdk/state/proof";
  import { fromHex } from "$sdk/encoding/hex";
  import { parseNetworkKind } from "$sdk/network/kind";
  import { grouped } from "$lib/format/display";

  let { address, asset, shown }: { address: string; asset: "AEY" | "ALnT"; shown: string } = $props();

  const ASSET_IDS = { AEY: 1, ALnT: 2 } as const;
  type State =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "proven"; height: number; matches: boolean }
    | { kind: "failed"; reason: string }
    | { kind: "unsupported" };
  let state: State = $state({ kind: "idle" });

  /** The base-units `available` field of an ACE-encoded Balance record (u128 LE first). */
  function availableOf(value: Uint8Array | null): string {
    if (!value) return "0";
    let units = 0n;
    for (let i = 15; i >= 0; i--) units = (units << 8n) | BigInt(value[i] ?? 0);
    return units.toString();
  }

  async function check() {
    state = { kind: "checking" };
    try {
      const response = await fetch(`/api/proof/${encodeURIComponent(address)}?asset=${asset}`);
      if (response.status === 501) {
        state = { kind: "unsupported" };
        return;
      }
      if (!response.ok) throw new Error("the node did not answer");
      const { answer, header, network } = await response.json();
      const kind = parseNetworkKind(network.kind);
      if (!kind) throw new Error(`unknown network ${network.kind}`);
      const value = verifyStateProof(
        { chainId: network.chainId, kind },
        fromHex(header.stateRoot),
        { kind: "balance", address: fromHex(address.slice(4)), assetId: ASSET_IDS[asset] },
        answer,
      );
      state = { kind: "proven", height: header.height, matches: availableOf(value) === shown };
    } catch (error) {
      state = { kind: "failed", reason: error instanceof ProofError ? error.message : (error as Error).message };
    }
  }
</script>

<div class="proof" aria-live="polite">
  {#if state.kind === "idle"}
    <button type="button" onclick={check}>Verify in your browser</button>
  {:else if state.kind === "checking"}
    <span class="muted">Checking the Merkle proof…</span>
  {:else if state.kind === "proven" && state.matches}
    <span class="ok">✓ Proven against the state root of block {grouped(state.height)}</span>
  {:else if state.kind === "proven"}
    <span class="warn">The proof holds at block {grouped(state.height)}, where the balance differs: the chain moved on. Reload to compare.</span>
  {:else if state.kind === "unsupported"}
    <span class="muted">This node does not serve state proofs yet.</span>
  {:else if state.kind === "failed"}
    <span class="bad">✗ The proof did not verify: {state.reason}</span>
  {/if}
</div>

<style>
  .proof {
    margin-top: 0.75rem;
    font-size: var(--fs-xs);
  }
  button {
    padding: 0.35rem 0.7rem;
    border-radius: 0.5rem;
    border: 1px solid rgb(196 154 78 / 0.6);
    background: transparent;
    color: var(--brand-gold-bright);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  button:hover,
  button:focus-visible {
    background: rgb(196 154 78 / 0.12);
  }
  .muted {
    color: var(--text-faint);
  }
  .ok {
    color: var(--ok);
    font-weight: 700;
  }
  .warn {
    color: var(--brand-gold-bright);
  }
  .bad {
    color: var(--fail);
    font-weight: 700;
  }
</style>
