<script lang="ts" generics="T extends string">
  // A small set of exclusive choices, as a radio group with arrow-key movement.
  let {
    label,
    options,
    value = $bindable(),
    hideLabel = false,
  }: {
    label: string;
    options: { value: T; label: string; disabled?: boolean }[];
    value: T;
    hideLabel?: boolean;
  } = $props();
  const name = `seg-${Math.random().toString(36).slice(2, 8)}`;
</script>

<fieldset class="segmented">
  <legend class="eyebrow" class:visually-hidden={hideLabel}>{label}</legend>
  <div class="options">
    {#each options as option (option.value)}
      <label class:checked={value === option.value} class:disabled={option.disabled}>
        <input type="radio" {name} value={option.value} bind:group={value} disabled={option.disabled} />
        <span>{option.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .segmented {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .options {
    display: inline-flex;
    flex-wrap: wrap;
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--radius-2);
    width: fit-content;
    max-width: 100%;
  }

  label {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink-secondary);
    cursor: pointer;
    transition:
      color var(--dur-quick) var(--ease-ink),
      background-color var(--dur-quick) var(--ease-ink);
  }

  label + label {
    border-inline-start: var(--hairline) solid var(--rule-hairline);
  }

  label:hover {
    color: var(--ink-heading);
  }

  .checked {
    color: var(--ink-heading);
    background: var(--surface-sunken);
  }

  .checked::after {
    content: "";
    position: absolute;
    left: var(--space-3);
    right: var(--space-3);
    bottom: 5px;
    height: var(--hairline);
    background: var(--ink-heading);
  }

  .disabled {
    color: var(--ink-disabled);
    cursor: not-allowed;
  }

  input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: inherit;
  }

  label:has(input:focus-visible) {
    outline: 1.5px solid var(--focus-ring);
    outline-offset: 2px;
    z-index: 1;
  }

  @media (pointer: coarse) {
    label {
      min-height: var(--target-touch);
    }
  }
</style>
