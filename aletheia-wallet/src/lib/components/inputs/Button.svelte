<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import type { IconName } from "$lib/design/icons/paths";

  let {
    variant = "quiet",
    href = null,
    type = "button",
    icon = null,
    disabled = false,
    busy = false,
    wide = false,
    onclick,
    children,
    ...rest
  }: {
    variant?: "primary" | "quiet" | "plain" | "danger";
    href?: string | null;
    type?: "button" | "submit";
    icon?: IconName | null;
    disabled?: boolean;
    busy?: boolean;
    wide?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

{#if href && !disabled}
  <a class="button {variant}" class:wide {href} {...rest}>
    {#if icon}<Icon name={icon} size={18} />{/if}<span>{@render children()}</span>
  </a>
{:else}
  <button
    class="button {variant}"
    class:wide
    class:busy
    {type}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    {onclick}
    {...rest}
  >
    {#if icon}<Icon name={icon} size={18} />{/if}<span>{@render children()}</span>
  </button>
{/if}

<style>
  .button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--button-height);
    padding: 0 var(--space-5);
    border-radius: var(--button-radius);
    font-weight: 650;
    font-size: 0.9375rem;
    letter-spacing: 0.01em;
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color var(--dur-quick) var(--ease-ink),
      color var(--dur-quick) var(--ease-ink),
      border-color var(--dur-quick) var(--ease-ink),
      transform var(--dur-instant) var(--ease-ink);
  }

  .button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .wide {
    width: 100%;
  }

  /* The single gold accent of a view: an engraved rule under the primary action. */
  .primary {
    background: var(--button-primary-bg);
    color: var(--button-primary-ink);
  }

  .primary::after {
    content: "";
    position: absolute;
    left: var(--space-3);
    right: var(--space-3);
    bottom: 5px;
    height: var(--hairline);
    background: var(--button-primary-accent);
    opacity: 0.9;
    transform-origin: center;
    transition: transform var(--dur-base) var(--ease-ink);
  }

  .primary:hover:not(:disabled) {
    background: var(--button-primary-bg-hover);
  }

  .primary:hover:not(:disabled)::after {
    transform: scaleX(1.06);
  }

  .quiet {
    color: var(--button-quiet-ink);
    border: var(--hairline) solid var(--button-quiet-rule);
    background: transparent;
  }

  .quiet:hover:not(:disabled) {
    border-color: var(--rule-strong);
    background: var(--surface-sunken);
  }

  .plain {
    color: var(--ink-heading);
    padding: 0 var(--space-2);
    min-height: var(--target-min);
    text-decoration: underline;
    text-decoration-color: var(--rule-control);
    text-underline-offset: 0.25em;
    text-decoration-thickness: var(--hairline);
  }

  .plain:hover:not(:disabled) {
    text-decoration-color: var(--accent-seal);
  }

  .danger {
    color: var(--state-rejected);
    border: var(--hairline) solid var(--state-rejected);
  }

  .danger:hover:not(:disabled) {
    background: var(--state-rejected-tint);
  }

  .button:disabled {
    color: var(--ink-disabled);
    background: transparent;
    border: var(--hairline) dashed var(--rule-hairline);
  }

  .button:disabled::after {
    display: none;
  }

  .busy {
    cursor: progress;
  }

  @media (pointer: coarse) {
    .button {
      min-height: var(--target-touch);
    }
  }
</style>
