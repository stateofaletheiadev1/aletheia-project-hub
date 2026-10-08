<script lang="ts">
  import Icon from "./Icon.svelte";

  let { value = "", autofocus = false }: { value?: string; autofocus?: boolean } = $props();
  let input: HTMLInputElement | undefined = $state();

  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input?.focus();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<form class="search" action="/search" method="GET" role="search">
  <label class="visually-hidden" for="q">Search the chain</label>
  <span class="glass"><Icon name="search" size={16} /></span>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={input}
    id="q"
    name="q"
    {value}
    {autofocus}
    autocomplete="off"
    spellcheck="false"
    placeholder="Block height, AL:T… transaction or AL:… address"
  />
  <kbd aria-hidden="true">/</kbd>
  <button type="submit">
    <Icon name="search" size={15} stroke={2} />
    Search
  </button>
</form>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: min(100%, 31rem);
    padding: 0.3rem 0.3rem 0.3rem 0.875rem;
    background: rgb(255 255 255 / 0.08);
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 0.75rem;
    box-shadow: var(--edge);
    transition:
      border-color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  .search:focus-within {
    border-color: rgb(196 154 78 / 0.85);
    background: rgb(255 255 255 / 0.11);
    box-shadow: 0 0 0 3px rgb(196 154 78 / 0.18);
  }
  .glass {
    color: var(--text-faint);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 0.45rem 0;
    border: 0;
    background: transparent;
    outline: none;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  input::placeholder {
    color: var(--text-faint);
    font-weight: 500;
  }
  kbd {
    padding: 0.05rem 0.4rem;
    font-family: var(--mono);
    font-size: var(--fs-2xs);
    color: var(--text-faint);
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 0.3rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    border: 0;
    border-radius: 0.55rem;
    background: var(--button);
    color: var(--button-text);
    font-size: var(--fs-sm);
    font-weight: 800;
    cursor: pointer;
    transition: background var(--quick) var(--ease);
  }
  button:hover {
    background: var(--brand-cream);
  }
  @media (max-width: 40rem) {
    kbd {
      display: none;
    }
  }
</style>
