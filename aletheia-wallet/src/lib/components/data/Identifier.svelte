<script lang="ts">
  // Addresses and ids (wallet prompt 5.4, M-06): Manrope, grouped for reading, middle-ellipsis that
  // reveals in full on hover or focus, and copy of the exact canonical string with an inline
  // "Copied" confirmation (no toast).
  import Icon from "$lib/design/icons/Icon.svelte";
  import { identifierParts, middleEllipsis, spokenIdentifier } from "$lib/formatting/identifier";

  let {
    value,
    label = "Address",
    truncate = false,
    copy = true,
    href = null,
    size = "data",
  }: {
    value: string;
    label?: string;
    truncate?: boolean;
    copy?: boolean;
    href?: string | null;
    size?: "data" | "large";
  } = $props();

  const parts = $derived(identifierParts(value));
  const short = $derived(middleEllipsis(value));
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }
</script>

<span class="identifier {size}" class:copied class:truncate>
  {#snippet text()}
    <span class="full numerals" aria-hidden="true">
      <span class="prefix">{parts.prefix}</span>{#each parts.groups as group, i (i)}<span class="group">{group}</span
        >{/each}
    </span>
    {#if truncate && short.tail}
      <span class="short numerals" aria-hidden="true"
        ><span>{short.head}</span><span class="ellipsis">…</span><span>{short.tail}</span></span
      >
    {/if}
    <span class="visually-hidden">{label}: {spokenIdentifier(value)}</span>
  {/snippet}
  {#if href}
    <a class="value" {href} target="_blank" rel="noopener noreferrer" title={value}>{@render text()}</a>
  {:else}
    <span class="value" title={value}>{@render text()}</span>
  {/if}
  {#if copy}
    <button type="button" class="copy" onclick={doCopy} aria-label="Copy {label.toLowerCase()}">
      <span class="icon-swap" class:on={copied}><Icon name="copy" size={16} /><Icon name="check" size={16} /></span>
    </button>
    <span class="confirm micro" role="status">{copied ? "Copied" : ""}</span>
  {/if}
</span>

<style>
  .identifier {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    max-width: 100%;
    position: relative;
  }

  .value {
    position: relative;
    min-width: 0;
    color: var(--ink-primary);
    text-decoration: none;
    font-size: var(--type-data);
    font-weight: var(--type-data-weight);
    letter-spacing: var(--type-data-track);
    padding-bottom: 2px;
    background: linear-gradient(var(--accent-seal), var(--accent-seal)) left bottom / 0% var(--hairline) no-repeat;
    transition: background-size var(--dur-base) var(--ease-ink);
  }

  .large .value {
    font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
    font-weight: 500;
    color: var(--ink-heading);
  }

  .copied .value {
    background-size: 100% var(--hairline);
  }

  .full {
    display: inline-flex;
    flex-wrap: wrap;
    column-gap: 0.32em;
    word-break: break-all;
  }

  .prefix {
    color: var(--ink-muted);
    margin-inline-end: -0.12em;
  }

  .truncate .full {
    display: none;
  }

  .truncate:hover .full,
  .truncate:focus-within .full {
    display: inline-flex;
  }

  .truncate:hover .short,
  .truncate:focus-within .short {
    display: none;
  }

  .short {
    display: inline-flex;
    gap: 0.2em;
    white-space: nowrap;
  }

  .ellipsis {
    color: var(--ink-muted);
  }

  .copy {
    display: inline-grid;
    place-items: center;
    width: var(--target-min);
    height: var(--target-min);
    min-width: var(--target-min);
    color: var(--ink-secondary);
    border-radius: var(--radius-1);
    transition: color var(--dur-quick) var(--ease-ink);
  }

  .copy:hover {
    color: var(--ink-heading);
  }

  .icon-swap {
    display: grid;
  }

  .icon-swap > :global(*) {
    grid-area: 1 / 1;
    transition:
      opacity var(--dur-quick) var(--ease-ink),
      transform var(--dur-quick) var(--ease-ink);
  }

  .icon-swap > :global(:last-child) {
    opacity: 0;
    transform: scale(0.6);
    color: var(--state-verified);
  }

  .icon-swap.on > :global(:first-child) {
    opacity: 0;
    transform: scale(0.6);
  }

  .icon-swap.on > :global(:last-child) {
    opacity: 1;
    transform: none;
  }

  .confirm {
    min-width: 6ch;
    color: var(--state-verified);
  }

  .confirm:empty {
    min-width: 0;
  }

  @media (pointer: coarse) {
    .copy {
      width: var(--target-touch);
      height: var(--target-touch);
    }
  }
</style>
