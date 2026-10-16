<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import Icon from "./Icon.svelte";

  // Back to where the reader came from inside the explorer (page, filters and scroll kept);
  // opened from outside, it leads to the register the record belongs to.
  let { href, label }: { href: string; label: string } = $props();
  let within = $state(false);
  afterNavigate(({ from }) => (within = within || from !== null));

  function back(event: MouseEvent) {
    if (!within || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    history.back();
  }
</script>

<nav class="back container" aria-label="Back">
  <a {href} onclick={back}>
    <span class="arrow"><Icon name="chevronLeft" size={14} stroke={2.2} /></span>
    {within ? "Back" : label}
  </a>
</nav>

<style>
  .back {
    padding-top: 1.75rem;
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.75rem 0.3rem 0.3rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-soft);
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.04);
    transition:
      color var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  a:hover {
    color: var(--text);
    border-color: rgb(196 154 78 / 0.6);
    background: rgb(196 154 78 / 0.08);
  }
  .arrow {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    transition: transform var(--quick) var(--ease);
  }
  a:hover .arrow {
    transform: translateX(-2px);
  }
</style>
