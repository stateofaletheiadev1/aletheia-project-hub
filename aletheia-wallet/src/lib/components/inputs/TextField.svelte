<script lang="ts">
  // A ruled field: eyebrow label, the value on an engraved rule, hint or error beneath (M-12 on
  // error). Labels are programmatic; errors are associated with aria-describedby.
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    label,
    value = $bindable(""),
    hint = null,
    error = null,
    id = `field-${Math.random().toString(36).slice(2, 9)}`,
    large = false,
    trailing,
    element = $bindable(),
    ...rest
  }: {
    label: string;
    value?: string;
    hint?: string | null;
    error?: string | null;
    id?: string;
    large?: boolean;
    trailing?: Snippet;
    element?: HTMLInputElement;
  } & Omit<HTMLInputAttributes, "value"> = $props();

  let shaking = $state(false);
  let lastError: string | null = null;
  $effect(() => {
    if (error && error !== lastError) {
      shaking = false;
      requestAnimationFrame(() => (shaking = true));
    }
    lastError = error;
  });
  const described = $derived(
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined,
  );
</script>

<div class="field" class:invalid={!!error} class:large>
  <label class="eyebrow" for={id}>{label}</label>
  <div class="line" class:tremor={shaking} onanimationend={() => (shaking = false)}>
    <input
      {id}
      bind:value
      bind:this={element}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={described}
      spellcheck="false"
      {...rest}
    />
    {#if trailing}<div class="trailing">{@render trailing()}</div>{/if}
  </div>
  {#if error}
    <p class="message error" id="{id}-error">{error}</p>
  {:else if hint}
    <p class="message" id="{id}-hint">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .line {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--field-height);
    border-bottom: var(--hairline) solid var(--field-rule);
    transition: border-color var(--dur-quick) var(--ease-ink);
  }

  .line::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 1.5px;
    background: var(--field-rule-focus);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-ink);
  }

  .line:focus-within::after {
    transform: scaleX(1);
  }

  input {
    flex: 1;
    min-width: 0;
    height: var(--field-height);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink-primary);
    font-size: 1.0625rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums lining-nums slashed-zero;
  }

  input:focus-visible {
    outline: none;
    animation: none;
  }

  input::placeholder {
    color: var(--ink-muted);
    opacity: 1;
    font-weight: 400;
  }

  .large input {
    font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem);
    font-weight: 300;
    letter-spacing: -0.02em;
    height: calc(var(--field-height) + var(--space-4));
  }

  .trailing {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--ink-secondary);
  }

  .message {
    font-size: var(--type-micro);
    font-weight: 500;
    color: var(--ink-secondary);
    max-width: var(--measure);
  }

  .invalid .line {
    border-bottom-color: var(--field-rule-error);
  }

  .invalid .line::after {
    background: var(--field-rule-error);
  }

  .error {
    color: var(--state-rejected);
  }
</style>
