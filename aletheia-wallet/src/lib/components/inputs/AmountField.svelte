<script lang="ts">
  // Amount entry (wallet prompt 9, 12.8): string in, exact base units out, with the asset's
  // decimals enforced and a Max from the real available balance.
  import TextField from "./TextField.svelte";
  import { AmountError, formatAmount, parseAmount, trimAmount } from "$lib/formatting/amount";

  let {
    value = $bindable(""),
    decimals,
    code,
    max = null,
    touched = false,
    over = false,
  }: {
    value?: string;
    decimals: number;
    code: string;
    max?: bigint | null;
    touched?: boolean;
    over?: boolean;
  } = $props();

  const error = $derived.by(() => {
    if (!touched || !value.trim()) return null;
    try {
      const units = parseAmount(value, decimals);
      if (units === 0n) return "Enter an amount above zero.";
      if (over) return "More than this account holds, including the fee.";
      return null;
    } catch (e) {
      return e instanceof AmountError ? `Amount: ${e.message}.` : "Enter an amount.";
    }
  });
</script>

<TextField
  label="Amount · {code}"
  bind:value
  {error}
  large
  inputmode="decimal"
  placeholder="0"
  autocomplete="off"
  hint="{code} has {decimals} decimal places."
>
  {#snippet trailing()}
    <span class="code eyebrow">{code}</span>
    {#if max !== null}
      <button
        type="button"
        class="max eyebrow"
        onclick={() => (value = trimAmount(formatAmount(max, decimals)))}
        disabled={max === 0n}>Max</button
      >
    {/if}
  {/snippet}
</TextField>

<style>
  .code {
    color: var(--ink-muted);
  }

  .max {
    min-height: var(--target-touch);
    padding: 0 var(--space-2);
    color: var(--ink-heading);
    text-decoration: underline;
    text-decoration-color: var(--rule-control);
    text-underline-offset: 0.3em;
  }

  .max:disabled {
    color: var(--ink-disabled);
  }
</style>
