<script lang="ts">
  // S-2 The Certificate: the phrase on a parchment sheet with a guilloché border and the arms as a
  // faint watermark; words masked until revealed, lifting word by word. No copy button (DDR-0005).
  import Guilloche from "$lib/components/foundations/Guilloche.svelte";

  let { words, revealed = false }: { words: readonly string[]; revealed?: boolean } = $props();
</script>

<section class="certificate" aria-label="Recovery certificate">
  <Guilloche variant="band" width={720} height={22} seed={5} />
  <header>
    <p class="eyebrow">Sovereign Covenant State of Aletheia</p>
    <h2>Recovery Certificate</h2>
    <p class="micro">{words.length} words · write them in order · keep them offline</p>
  </header>
  <ol class="words" class:revealed>
    {#each words as word, i (i)}
      <li style:--i={i}>
        <span class="n numerals" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
        <span class="word">
          <span class="ink" aria-hidden={!revealed}>{revealed ? word : "••••••"}</span>
          <span class="vellum" aria-hidden="true"></span>
        </span>
        {#if !revealed}<span class="visually-hidden">Word {i + 1} hidden</span>{/if}
      </li>
    {/each}
  </ol>
  <Guilloche variant="band" width={720} height={22} seed={9} />
  <img class="watermark" src="/brand/arms-720.png" alt="" width="360" height="443" />
</section>

<style>
  .certificate {
    position: relative;
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-8);
    background: var(--surface-sheet);
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--sheet-radius);
    overflow: hidden;
    isolation: isolate;
    user-select: none;
    -webkit-user-select: none;
  }

  .certificate::before {
    content: "";
    position: absolute;
    inset: var(--space-2);
    border: var(--hairline) solid var(--rule-hairline);
    border-radius: var(--radius-2);
    pointer-events: none;
  }

  .watermark {
    position: absolute;
    inset: 50% auto auto 50%;
    width: 46%;
    max-width: 320px;
    height: auto;
    transform: translate(-50%, -50%);
    opacity: var(--watermark-opacity);
    z-index: -1;
    pointer-events: none;
  }

  header {
    display: grid;
    gap: var(--space-1);
    text-align: center;
    justify-items: center;
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .words {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0 var(--space-6);
    counter-reset: word;
  }

  li {
    display: grid;
    grid-template-columns: 2.4ch 1fr;
    align-items: baseline;
    gap: var(--space-2);
    min-height: 44px;
    padding-top: var(--space-3);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .n {
    font-size: var(--type-micro);
    font-weight: 600;
    color: var(--accent-seal-ink);
  }

  .word {
    position: relative;
    font-size: 1.0625rem;
    font-weight: 650;
    color: var(--ink-heading);
    letter-spacing: 0.01em;
  }

  .ink {
    color: var(--ink-muted);
  }

  .revealed .ink {
    color: var(--ink-heading);
  }

  .vellum {
    position: absolute;
    inset: -2px -4px;
    background: var(--surface-sunken);
    border-radius: var(--radius-1);
    transform-origin: top center;
    opacity: 0;
  }

  .revealed .vellum {
    animation: lift var(--dur-considered) var(--ease-ink) both;
    animation-delay: calc(var(--i) * 40ms);
  }

  @keyframes lift {
    from {
      opacity: 1;
      transform: none;
    }
    to {
      opacity: 0;
      transform: translateY(-6px) scaleY(0.4);
    }
  }

  @media (max-width: 720px) {
    .certificate {
      padding: var(--space-5) var(--space-4);
    }

    .words {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media print {
    .certificate {
      display: none;
    }
  }
</style>
