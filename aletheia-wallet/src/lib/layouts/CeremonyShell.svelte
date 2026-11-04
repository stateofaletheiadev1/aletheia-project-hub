<script lang="ts">
  // Create, import, unlock, recovery: a quiet stage over the ceremony terrain, with an optional
  // ruled margin index of steps (wallet prompt 8 Create).
  import type { Snippet } from "svelte";
  import ContourField from "$lib/components/foundations/ContourField.svelte";
  import Wordmark from "./Wordmark.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { config } from "$lib/config";
  import { isTestNetwork, networkLabel } from "$lib/stablechain/network/kind";

  let {
    children,
    steps = null,
    current = 0,
  }: { children: Snippet; steps?: readonly string[] | null; current?: number } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="ceremony">
  <ContourField field="ceremony" />
  <header class="top">
    <Wordmark href="/" />
    <div class="end">
      {#if isTestNetwork(config.network)}<span class="eyebrow test">Test network · {networkLabel(config.network)}</span
        >{/if}
      <ThemeToggle />
    </div>
  </header>
  <div class="body" class:with-steps={!!steps}>
    {#if steps}
      <nav class="margin" aria-label="Steps">
        <ol>
          {#each steps as step, i (step)}
            <li
              class:done={i < current}
              class:current={i === current}
              aria-current={i === current ? "step" : undefined}
            >
              <span class="numerals">{["I", "II", "III", "IV", "V", "VI"][i]}</span>
              <span>{step}</span>
            </li>
          {/each}
        </ol>
      </nav>
    {/if}
    <main id="main" style="view-transition-name: page">
      {@render children()}
    </main>
  </div>
</div>

<style>
  .ceremony {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
  }

  .top {
    position: relative;
    z-index: var(--z-content);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6) var(--page-margin);
  }

  .end {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .test {
    color: var(--test-band);
  }

  .body {
    position: relative;
    z-index: var(--z-content);
    display: grid;
    padding: var(--space-8) var(--page-margin) var(--space-20);
  }

  .with-steps {
    grid-template-columns: 200px minmax(0, 1fr);
    gap: var(--space-12);
  }

  main {
    min-width: 0;
    max-width: 880px;
  }

  .margin ol {
    position: sticky;
    top: var(--space-8);
    display: grid;
    border-inline-end: var(--hairline) solid var(--rule-hairline);
  }

  .margin li {
    display: grid;
    grid-template-columns: 3ch 1fr;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-3) var(--space-4) var(--space-3) 0;
    color: var(--ink-muted);
    font-weight: 600;
    font-size: 0.9375rem;
    border-bottom: var(--hairline) solid var(--rule-faint);
  }

  .margin li.done {
    color: var(--ink-secondary);
  }

  .margin li.current {
    color: var(--ink-heading);
    box-shadow: inset calc(var(--rule-thick) * -1) 0 0 var(--accent-seal);
  }

  .margin .numerals {
    font-size: var(--type-micro);
    letter-spacing: 0.06em;
  }

  @media (max-width: 860px) {
    .with-steps {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
    }

    .margin ol {
      position: static;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      border-inline-end: 0;
      border-bottom: var(--hairline) solid var(--rule-hairline);
    }

    .margin li {
      grid-template-columns: 1fr;
      gap: 0;
      border-bottom: 0;
      font-size: var(--type-micro);
      padding-inline-end: var(--space-2);
    }

    .margin li span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .margin li.current {
      box-shadow: inset 0 calc(var(--rule-thick) * -1) 0 var(--accent-seal);
    }
  }
</style>
