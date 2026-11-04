<script lang="ts">
  // Recovery-phrase entry (wallet prompt 8 Import, 9): numbered cells, paste-to-split, per-word
  // autocomplete from the public wordlist, and per-word validity. The checksum is checked by the
  // caller. Words never leave this component except through `words`.
  import { isWord, suggest } from "$lib/wallet/mnemonic/wordlist";

  let { words = $bindable(Array(24).fill("") as string[]), count = 24 }: { words?: string[]; count?: number } =
    $props();

  let focused = $state<number | null>(null);
  const inputs: HTMLInputElement[] = $state([]);
  const suggestions = $derived(focused !== null ? suggest(words[focused] ?? "", 4) : []);

  function onpaste(event: ClipboardEvent, index: number) {
    const text = event.clipboardData?.getData("text") ?? "";
    const parts = text
      .trim()
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (parts.length > 1) {
      event.preventDefault();
      const next = [...words];
      parts.slice(0, count - index).forEach((word, i) => (next[index + i] = word));
      words = next;
      inputs[Math.min(count - 1, index + parts.length)]?.focus();
    }
  }

  function choose(index: number, word: string) {
    const next = [...words];
    next[index] = word;
    words = next;
    inputs[index + 1]?.focus();
  }

  function onkeydown(event: KeyboardEvent, index: number) {
    if (
      (event.key === "Enter" || event.key === "Tab") &&
      !event.shiftKey &&
      suggestions.length === 1 &&
      suggestions[0] !== words[index]
    ) {
      event.preventDefault();
      choose(index, suggestions[0]!);
    } else if (event.key === " ") {
      event.preventDefault();
      inputs[index + 1]?.focus();
    }
  }
</script>

<fieldset class="grid">
  <legend class="visually-hidden">Recovery phrase, {count} words</legend>
  {#each Array(count) as _, i (i)}
    {@const word = (words[i] ?? "").trim()}
    {@const bad = word.length > 0 && focused !== i && !isWord(word)}
    <div class="cell" class:bad class:good={word.length > 0 && isWord(word)}>
      <label for="word-{i}" class="number numerals">{String(i + 1).padStart(2, "0")}</label>
      <input
        id="word-{i}"
        bind:this={inputs[i]}
        bind:value={words[i]}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-invalid={bad ? "true" : undefined}
        aria-label="Word {i + 1}"
        onfocus={() => (focused = i)}
        onblur={() => (focused = null)}
        onpaste={(e) => onpaste(e, i)}
        onkeydown={(e) => onkeydown(e, i)}
      />
      {#if focused === i && suggestions.length && !(suggestions.length === 1 && suggestions[0] === word)}
        <ul class="suggest" role="listbox" aria-label="Suggestions for word {i + 1}">
          {#each suggestions as s (s)}
            <li role="option" aria-selected="false">
              <button type="button" onmousedown={(e) => e.preventDefault()} onclick={() => choose(i, s)}>{s}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</fieldset>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0 var(--space-6);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .cell {
    position: relative;
    display: grid;
    grid-template-columns: 2.4ch 1fr;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--row-height);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .number {
    font-size: var(--type-micro);
    font-weight: 600;
    color: var(--ink-muted);
  }

  input {
    min-width: 0;
    height: 40px;
    border: 0;
    background: transparent;
    font-size: 1rem;
    font-weight: 600;
    color: var(--ink-heading);
  }

  input:focus-visible {
    outline: none;
    animation: none;
  }

  .cell:focus-within {
    border-bottom-color: var(--focus-ring);
  }

  .good .number {
    color: var(--state-verified);
  }

  .bad {
    border-bottom-color: var(--state-rejected);
  }

  .bad .number,
  .bad input {
    color: var(--state-rejected);
  }

  .suggest {
    position: absolute;
    top: 100%;
    left: 2.4ch;
    z-index: var(--z-sheet);
    display: grid;
    min-width: 10ch;
    background: var(--surface-raised);
    border: var(--hairline) solid var(--rule-strong);
    border-radius: var(--radius-2);
  }

  .suggest button {
    width: 100%;
    min-height: var(--target-touch);
    padding: 0 var(--space-3);
    text-align: start;
    font-weight: 600;
  }

  .suggest button:hover,
  .suggest button:focus-visible {
    background: var(--surface-sunken);
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
