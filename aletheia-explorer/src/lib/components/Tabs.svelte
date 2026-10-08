<script lang="ts">
  // PolygonScan's tab row. Tabs are links (?tab=…), so every tab has its own address and
  // works without JavaScript.
  let { tabs, current }: { tabs: { id: string; label: string; href: string }[]; current: string } = $props();
</script>

<nav class="tabs" aria-label="Sections">
  {#each tabs as tab (tab.id)}
    <a href={tab.href} class:active={tab.id === current} aria-current={tab.id === current ? "page" : undefined} data-sveltekit-noscroll>{tab.label}</a>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  a {
    padding: 0.45rem 0.9rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.05);
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.5rem;
    transition:
      color var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  a:hover {
    color: var(--text);
    border-color: rgb(196 154 78 / 0.5);
  }
  a.active {
    color: var(--brand-cream);
    background: var(--brand-navy);
    border-color: var(--brand-gold);
  }
</style>
