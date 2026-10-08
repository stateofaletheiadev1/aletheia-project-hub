<script lang="ts">
  import Arms from "./Arms.svelte";
  import Crest from "./Crest.svelte";
  import FlagHexagon from "./FlagHexagon.svelte";
  import FlagNational from "./FlagNational.svelte";

  let { protocolVersion = 1 }: { protocolVersion?: number } = $props();

  const columns = [
    {
      title: "Consensus & Staking",
      links: [
        ["Validators & Staking", "/validators"],
        ["Governance", "/section/governance"],
        ["Network Analytics", "/section/network"],
      ],
    },
    {
      title: "Sovereign Services",
      links: [
        ["Land Registry", "/section/land"],
        ["Identity & Residence", "/section/identity"],
        ["National Treasury", "/treasury"],
      ],
    },
    {
      title: "Assets & Payments",
      links: [
        ["Cross-Chain Bridge", "/section/bridge"],
        ["Payment Network", "/section/payments"],
        ["Arno Contracts", "/section/contracts"],
      ],
    },
    {
      title: "Protocol Resources",
      links: [
        ["Developer Docs", "/section/docs"],
        ["Security Policy", "/section/security"],
      ],
    },
  ] as const;
</script>

<footer>
  <div class="container">
    <section class="state" aria-label="Sovereign Covenant State of Aletheia">
      <div class="arms"><Arms height={168} /></div>
      <div class="words">
        <p class="eyebrow">The public record of</p>
        <h2>Sovereign Covenant State of Aletheia</h2>
        <p class="motto">Veritas in Foedere</p>
        <p class="line">
          Aletheia StableChain carries the State's legal tender, the Aletheian Guilder. Every block here is final, and every
          figure is read from finalized state.
        </p>
      </div>
      <div class="flags">
        <figure>
          <FlagNational width={96} />
        </figure>
        <figure>
          <FlagHexagon width={96} />
        </figure>
      </div>
    </section>

    <div class="grid">
      {#each columns as column (column.title)}
        <div>
          <h3 class="label">{column.title}</h3>
          <ul>
            {#each column.links as [label, href] (href)}
              <li><a {href}>{label}</a></li>
            {/each}
            {#if column.title === "Protocol Resources"}
              <li class="version">v0.1.0 · Protocol {protocolVersion}</li>
            {/if}
          </ul>
        </div>
      {/each}
    </div>

    <div class="base">
      <div class="mark">
        <Crest size={22} />
        <span>© 2026 Sovereign Covenant State of Aletheia · Aletheia StableChain. All rights reserved.</span>
      </div>
      <span class="note">Every figure on this site is read from finalized blocks.</span>
    </div>
  </div>
</footer>

<style>
  footer {
    margin-top: 4.5rem;
    padding: 3rem 0 2rem;
    background: linear-gradient(180deg, rgb(12 39 134 / 0.35), rgb(12 39 134 / 0.85));
    border-top: 1px solid rgb(255 255 255 / 0.08);
  }
  .state {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 2.5rem;
    padding-bottom: 2.75rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid rgb(196 154 78 / 0.35);
  }
  .eyebrow {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  h2 {
    margin-top: 0.25rem;
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.025em;
  }
  .motto {
    margin-top: 0.4rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .line {
    margin-top: 0.875rem;
    max-width: 34rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
  }
  .flags {
    display: flex;
    gap: 1.25rem;
  }
  figure {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
  }
  h3 {
    margin: 0 0 0.875rem;
    color: var(--text);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }
  a {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-soft);
    transition: color var(--quick) var(--ease);
  }
  a:hover {
    color: var(--accent);
  }
  .version {
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .base {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgb(255 255 255 / 0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .mark {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  @media (max-width: 60rem) {
    .state {
      grid-template-columns: auto 1fr;
    }
    .flags {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 48rem) {
    .state {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
    }
    .line {
      margin-inline: auto;
    }
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
