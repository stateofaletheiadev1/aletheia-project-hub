<script lang="ts">
  // An amount set like a denomination on a note (wallet prompt 4.3, 5.4): integer large and tabular,
  // separator and fraction lighter and smaller, baseline-aligned. Exact string arithmetic only.
  // M-04: digits roll per place when the value changes; the final value alone is announced.
  import { amountParts, type Precision } from "$lib/formatting/amount";
  import { prefs } from "$lib/state/prefs.svelte";

  let {
    units,
    decimals,
    code,
    precision = prefs.precision,
    size = "inline",
    announce = false,
    signed = null,
  }: {
    units: bigint;
    decimals: number;
    code?: string;
    precision?: Precision;
    size?: "hero" | "secondary" | "title" | "inline";
    announce?: boolean;
    signed?: "in" | "out" | null;
  } = $props();

  const parts = $derived(amountParts(units, decimals, { locale: prefs.locale, precision }));
  const integerChars = $derived(
    [...parts.integer]
      .reverse()
      .map((c, i) => ({ c, key: i }))
      .reverse(),
  );
  const fractionChars = $derived([...parts.fraction].map((c, i) => ({ c, key: i })));
  const spoken = $derived(
    `${signed === "out" ? "minus " : signed === "in" ? "plus " : ""}${parts.exact} ${code ?? ""}`.trim(),
  );

  let lastAnnounced = $state<string | null>(null);
  let liveText = $state("");
  $effect(() => {
    const value = spoken;
    if (!announce) return;
    if (lastAnnounced !== null && lastAnnounced !== value) liveText = `Balance now ${value}`;
    lastAnnounced = value;
  });
</script>

<span class="denomination {size}" class:signed-in={signed === "in"} class:signed-out={signed === "out"}>
  <span class="visually-hidden">{spoken}</span>
  <span class="figure numerals" aria-hidden="true">
    {#if signed}<span class="sign">{signed === "in" ? "+" : "−"}</span>{/if}
    <span class="integer">
      {#each integerChars as { c, key } (key)}
        {#if c >= "0" && c <= "9"}
          <span class="place"
            ><span class="strip" style:--d={c}>0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</span
            ></span
          >
        {:else}
          <span class="group">{c}</span>
        {/if}
      {/each}
    </span>
    {#if parts.separator}
      <span class="fraction"
        ><span class="separator">{parts.separator}</span>{#each fractionChars as { c, key } (key)}<span class="place"
            ><span class="strip" style:--d={c}>0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</span
            ></span
          >{/each}</span
      >
    {/if}
  </span>
  {#if code}<span class="code eyebrow" aria-hidden="true">{code}</span>{/if}
  {#if announce}<span class="visually-hidden" aria-live="polite">{liveText}</span>{/if}
</span>

<style>
  .denomination {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45em;
    color: var(--ink-heading);
    white-space: nowrap;
    max-width: 100%;
  }

  .figure {
    display: inline-flex;
    align-items: baseline;
    line-height: 1;
  }

  .integer,
  .fraction {
    display: inline-flex;
    align-items: baseline;
  }

  .place {
    display: inline-block;
    height: 1em;
    overflow: hidden;
    line-height: 1;
    vertical-align: baseline;
  }

  .strip {
    display: block;
    transform: translateY(calc(var(--d) * -1em));
    transition: transform var(--dur-considered) var(--ease-ink);
  }

  .fraction {
    font-size: 0.55em;
    font-weight: 400;
    color: var(--ink-secondary);
    margin-inline-start: 0.04em;
  }

  .separator {
    margin-inline-end: 0.04em;
  }

  .sign {
    margin-inline-end: 0.12em;
    font-weight: 400;
  }

  .code {
    color: var(--ink-secondary);
    font-size: var(--type-eyebrow);
  }

  .hero {
    font-size: var(--type-denomination);
    font-weight: var(--type-denomination-weight);
    letter-spacing: var(--type-denomination-track);
    gap: 0.25em;
  }

  .hero .fraction {
    font-weight: 300;
  }

  .hero .code {
    letter-spacing: var(--type-eyebrow-track);
  }

  .secondary {
    font-size: clamp(1.75rem, 1.4rem + 1.2vw, 2.5rem);
    font-weight: 300;
    letter-spacing: -0.02em;
  }

  .title {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .inline {
    font-size: inherit;
    font-weight: 600;
    gap: 0.35em;
  }

  .inline .fraction {
    font-size: 0.82em;
    font-weight: 500;
  }

  .signed-in {
    color: var(--state-verified);
  }

  .signed-in .fraction,
  .signed-out .fraction {
    color: inherit;
  }

  :global(:root[data-motion="reduce"]) .strip {
    transition: none;
  }
</style>
