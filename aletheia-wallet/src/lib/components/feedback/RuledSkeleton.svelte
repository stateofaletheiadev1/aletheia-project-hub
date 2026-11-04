<script lang="ts">
  // M-11: loading as ruled paper — the real layout's rules with faint bars, washed once slowly.
  let { rows = 4, label = "Loading" }: { rows?: number; label?: string } = $props();
</script>

<div class="skeleton ruled-wash" role="status" aria-label={label}>
  {#each Array(rows) as _, i (i)}
    <div class="row">
      <span class="bar" style:width="{18 + ((i * 37) % 22)}%"></span>
      <span class="bar short" style:width="{10 + ((i * 23) % 12)}%"></span>
    </div>
  {/each}
</div>

<style>
  .skeleton {
    display: grid;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--row-height);
    border-bottom: var(--hairline) solid var(--ledger-rule);
  }

  .bar {
    height: 8px;
    border-radius: var(--radius-1);
    background: var(--skeleton-bar);
  }
</style>
