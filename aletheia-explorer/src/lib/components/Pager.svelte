<script lang="ts">
  import Icon from "./Icon.svelte";

  let { newer, older, label }: { newer: string | null; older: string | null; label: string } = $props();
</script>

<nav class="pager" aria-label="Pages">
  {#if newer}<a href={newer}><Icon name="chevronLeft" size={14} stroke={2} /> Newer</a>{:else}<span class="off"><Icon name="chevronLeft" size={14} stroke={2} /> Newer</span>{/if}
  <span class="label num">{label}</span>
  {#if older}<a href={older}>Older <Icon name="chevronRight" size={14} stroke={2} /></a>{:else}<span class="off">Older <Icon name="chevronRight" size={14} stroke={2} /></span>{/if}
</nav>

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.25rem;
  }
  a,
  .off {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.9rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    border-radius: 0.5rem;
    border: 1px solid rgb(196 154 78 / 0.45);
    background: var(--brand-navy);
    color: var(--brand-cream);
    transition:
      border-color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  a:hover {
    border-color: var(--brand-gold);
    background: var(--brand-navy-deep);
  }
  .off {
    opacity: 0.4;
  }
  .label {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
</style>
