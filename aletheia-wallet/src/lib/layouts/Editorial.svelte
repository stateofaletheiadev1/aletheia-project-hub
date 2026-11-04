<script lang="ts">
  // Long-form editorial layout for public pages: eyebrow, display title, lede, then a narrow
  // measure with a margin index of the sections.
  import type { Snippet } from "svelte";

  let {
    eyebrow,
    title,
    lede,
    sections = [],
    children,
  }: {
    eyebrow: string;
    title: string;
    lede: string;
    sections?: { id: string; label: string }[];
    children: Snippet;
  } = $props();
</script>

<article class="editorial">
  <header class="settle">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
  </header>
  <div class="body" class:indexed={sections.length > 0}>
    {#if sections.length}
      <nav class="index" aria-label="On this page">
        <ol>
          {#each sections as s, i (s.id)}<li>
              <a href="#{s.id}"><span class="numerals">{String(i + 1).padStart(2, "0")}</span> {s.label}</a>
            </li>{/each}
        </ol>
      </nav>
    {/if}
    <div class="prose">{@render children()}</div>
  </div>
</article>

<style>
  .editorial {
    display: grid;
    gap: var(--space-12);
    padding: var(--space-12) 0 var(--space-20);
  }

  header {
    display: grid;
    gap: var(--space-4);
    max-width: 820px;
  }

  h1 {
    font-size: clamp(2.5rem, 1.8rem + 2.4vw, 4rem);
    font-weight: 300;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }

  .body {
    display: grid;
    gap: var(--space-12);
  }

  .indexed {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .index ol {
    position: sticky;
    top: var(--space-8);
    display: grid;
    border-top: var(--hairline) solid var(--rule-strong);
  }

  .index a {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ink-secondary);
  }

  .index a:hover {
    color: var(--ink-heading);
  }

  .index .numerals {
    color: var(--ink-muted);
    font-size: var(--type-micro);
  }

  .prose {
    display: grid;
    gap: var(--space-10);
    max-width: 72ch;
  }

  .prose :global(section) {
    display: grid;
    gap: var(--space-3);
    scroll-margin-top: var(--space-8);
    padding-top: var(--space-5);
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .prose :global(h2) {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: var(--type-title-track);
  }

  .prose :global(p),
  .prose :global(li) {
    color: var(--ink-secondary);
  }

  .prose :global(ul) {
    display: grid;
    gap: var(--space-2);
    padding-inline-start: var(--space-5);
    list-style: square;
  }

  .prose :global(strong) {
    color: var(--ink-primary);
    font-weight: 650;
  }

  @media (max-width: 900px) {
    .indexed {
      grid-template-columns: minmax(0, 1fr);
    }

    .index {
      display: none;
    }
  }
</style>
