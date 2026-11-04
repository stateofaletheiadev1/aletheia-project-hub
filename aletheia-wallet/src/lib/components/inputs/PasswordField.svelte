<script lang="ts">
  // Password entry with show/hide and, when `strength` is set, an estimate from zxcvbn-ts loaded
  // on first keystroke (wallet prompt 9). Only the score is used; the words are ours.
  import TextField from "./TextField.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";

  let {
    label = "Password",
    value = $bindable(""),
    error = null,
    hint = null,
    strength = false,
    score = $bindable<number | null>(null),
    autocomplete = "current-password",
    id,
  }: {
    label?: string;
    value?: string;
    error?: string | null;
    hint?: string | null;
    strength?: boolean;
    score?: number | null;
    autocomplete?: "current-password" | "new-password";
    id?: string;
  } = $props();

  let visible = $state(false);
  let checker: ((password: string) => number) | null = null;
  let loading: Promise<void> | null = null;

  async function load() {
    loading ??= Promise.all([import("@zxcvbn-ts/core"), import("@zxcvbn-ts/language-common")]).then(
      ([core, common]) => {
        const factory = new core.ZxcvbnFactory({
          dictionary: { ...common.dictionary },
          graphs: common.adjacencyGraphs,
        });
        checker = (password) => factory.check(password).score;
      },
    );
    return loading;
  }

  $effect(() => {
    const current = value;
    if (!strength) return;
    if (!current) {
      score = null;
      return;
    }
    void load().then(() => {
      if (value === current && checker) score = checker(current);
    });
  });

  const WORDS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const advice = $derived(
    score === null
      ? (hint ?? "At least 12 characters. A few unrelated words make a strong, memorable password.")
      : score < 3
        ? "Add length or unrelated words. This password protects this device's copy only."
        : "Good. Keep it somewhere safe; it cannot be reset by anyone.",
  );
</script>

<div class="password">
  <TextField
    {label}
    bind:value
    {error}
    hint={strength ? advice : hint}
    type={visible ? "text" : "password"}
    {autocomplete}
    {...id ? { id } : {}}
  >
    {#snippet trailing()}
      <button
        type="button"
        class="toggle"
        onclick={() => (visible = !visible)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={18} />
      </button>
    {/snippet}
  </TextField>
  {#if strength}
    <div class="meter" aria-hidden={score === null}>
      <div class="bars">
        {#each [0, 1, 2, 3] as i (i)}<span
            class:on={score !== null && score > i}
            class:good={score !== null && score >= 3}
          ></span>{/each}
      </div>
      <span class="micro" aria-live="polite">{score === null ? "" : WORDS[score]}</span>
    </div>
  {/if}
</div>

<style>
  .password {
    display: grid;
    gap: var(--space-2);
  }

  .toggle {
    display: grid;
    place-items: center;
    width: var(--target-touch);
    height: var(--target-touch);
    color: var(--ink-secondary);
  }

  .toggle:hover {
    color: var(--ink-heading);
  }

  .meter {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--space-5);
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(4, 32px);
    gap: var(--space-1);
  }

  .bars span {
    height: var(--rule-thick);
    background: var(--rule-hairline);
    transition: background-color var(--dur-base) var(--ease-ink);
  }

  .bars span.on {
    background: var(--state-pending);
  }

  .bars span.on.good {
    background: var(--state-verified);
  }
</style>
