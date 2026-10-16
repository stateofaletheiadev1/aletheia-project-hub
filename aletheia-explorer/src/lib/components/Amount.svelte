<script lang="ts">
  import { amountParts } from "$lib/format/display";

  // A sum as a ledger sets it: whole units carry the weight, the fraction steps back, the
  // asset code follows in gold. The exact value is the title.
  let { units, asset, showAsset = true }: { units: string; asset: string; showAsset?: boolean } = $props();

  const value = $derived(amountParts(units, asset));
</script>

<span class="amount num" title="{value.exact} {asset}"
  ><span class="whole">{value.whole}</span><span class="fraction">{value.fraction}</span
  >{#if showAsset}<span class="asset">{asset}</span>{/if}</span
>

<style>
  .amount {
    white-space: nowrap;
  }
  .fraction {
    opacity: 0.66;
  }
  .asset {
    margin-left: 0.32em;
    font-size: 0.72em;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--gold);
  }
</style>
