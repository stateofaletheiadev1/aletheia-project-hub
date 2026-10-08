<script lang="ts">
  import Icon from "./Icon.svelte";

  let { value, label = "Copy" }: { value: string; label?: string } = $props();
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1400);
    } catch {
      copied = false;
    }
  }
</script>

<button type="button" class="copy" class:copied onclick={copy} aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label}>
  <Icon name={copied ? "check" : "copy"} size={14} />
</button>

<style>
  .copy {
    display: inline-grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    transition:
      color var(--quick) var(--ease),
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease);
  }
  .copy:hover {
    color: var(--text);
    background: rgb(255 255 255 / 0.08);
    border-color: var(--line-soft);
  }
  .copied {
    color: var(--ok);
  }
</style>
