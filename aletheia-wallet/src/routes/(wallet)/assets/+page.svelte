<script lang="ts">
  // Assets (wallet prompt 8): numismatic roundels for AEY and ALnT, decimals and supply as the chain
  // reports them, and the account's own holding. Figures are read, never assumed.
  import { onMount } from "svelte";
  import AssetRoundel from "$lib/components/data/AssetRoundel.svelte";
  import Denomination from "$lib/components/data/Denomination.svelte";
  import RuledSkeleton from "$lib/components/feedback/RuledSkeleton.svelte";
  import { ASSETS, ASSET_CODES, type AssetCode } from "$lib/stablechain/assets/assets";
  import type { Supply } from "$lib/stablechain/rpc/types";
  import { groupWhole } from "$lib/formatting/amount";
  import { chain } from "$lib/state/chain";
  import { ledger } from "$lib/state/ledger.svelte";
  import { network } from "$lib/state/network.svelte";
  import { prefs } from "$lib/state/prefs.svelte";

  let supply = $state<Partial<Record<AssetCode, Supply | null>>>({});

  onMount(() => {
    for (const code of ASSET_CODES) {
      chain
        .supply(code)
        .then((s) => (supply = { ...supply, [code]: s }))
        .catch(() => (supply = { ...supply, [code]: null }));
    }
  });

  const ABOUT: Record<AssetCode, string> = {
    AEY: "The Aletheian Guilder, the settlement unit of AletheiaChain, denominated against the euro. Issuance is governed by the Reserve Bank of Aletheia.",
    ALnT: "Aletheia Talent, the network's utility asset: it pays execution fees and secures the validator set. Its supply was fixed at genesis.",
  };
</script>

<svelte:head><title>Assets · Aletheia Wallet</title></svelte:head>

<div class="assets">
  <header class="settle">
    <p class="eyebrow">Native assets</p>
    <h1>Assets</h1>
  </header>

  {#each ASSET_CODES as code, i (code)}
    {@const spec = ASSETS[code]}
    {@const s = supply[code]}
    <article class="asset settle" style:--settle-order={i + 1}>
      <div class="identity">
        <AssetRoundel asset={code} size={96} />
        <div>
          <p class="eyebrow">{code} · asset {spec.id}</p>
          <h2>{spec.name}</h2>
          <p class="about">{ABOUT[code]}</p>
        </div>
      </div>
      <dl>
        <div>
          <dt class="eyebrow">You hold</dt>
          <dd>
            {#if ledger.snapshot}<Denomination
                units={ledger.snapshot[code].available}
                decimals={spec.decimals}
                {code}
                size="title"
              />{:else}—{/if}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Decimals</dt>
          <dd class="numerals">{spec.decimals} · smallest unit {spec.baseUnit}</dd>
        </div>
        <div>
          <dt class="eyebrow">Transfers</dt>
          <dd>
            {network.verified
              ? network.verified.assets[code].transferable
                ? "Transferable"
                : "Not transferable at present"
              : "—"}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">In circulation</dt>
          <dd>
            {#if s === undefined}<RuledSkeleton rows={1} label="Reading supply" />{:else if s === null}<span
                class="muted">Not reported by the node</span
              >{:else}
              <Denomination units={BigInt(s.circulating)} decimals={spec.decimals} {code} />
              <span class="micro"> · block {groupWhole(s.height, prefs.locale)}</span>
            {/if}
          </dd>
        </div>
      </dl>
    </article>
  {/each}
</div>

<style>
  .assets {
    display: grid;
    gap: var(--space-10);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .asset {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-12);
    padding-top: var(--space-8);
    border-top: var(--hairline) solid var(--rule-strong);
  }

  .identity {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
    margin: var(--space-1) 0 var(--space-3);
  }

  .about {
    color: var(--ink-secondary);
    max-width: 48ch;
  }

  dl > div {
    display: grid;
    grid-template-columns: 14ch minmax(0, 1fr);
    gap: var(--space-4);
    align-items: baseline;
    min-height: var(--row-height);
    padding: var(--space-3) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  dd {
    margin: 0;
    font-size: var(--type-data);
    font-weight: 500;
  }

  .muted {
    color: var(--ink-muted);
  }

  @media (max-width: 900px) {
    .asset {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
    }
  }
</style>
