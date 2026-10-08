<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import SearchBox from "$lib/components/SearchBox.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import BlockRow from "$lib/components/BlockRow.svelte";
  import TxRow from "$lib/components/TxRow.svelte";
  import Star from "$lib/components/Star.svelte";
  import { useLive } from "$lib/context";
  import { compactUnits, grouped } from "$lib/format/display";

  const live = useLive();
  const stats = $derived(live.stats);
  const blockTime = $derived(
    stats?.avgBlockMs ? `${(stats.avgBlockMs / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}s block time` : "Finalized blocks",
  );
</script>

<svelte:head>
  <title>Aletheia Explorer · Consensus & Ledger</title>
</svelte:head>

<section class="hero container">
  <!-- The flag's star, very faint, behind the title: felt more than seen. -->
  <div class="watermark" aria-hidden="true"><Star size={420} hole="transparent" /></div>
  <div class="title">
    <p class="eyebrow"><Star size={11} hole="var(--bg)" /> Sovereign Covenant State of Aletheia · StableChain</p>
    <h1>Consensus & Ledger Dashboard</h1>
    <p class="lede">Real-time finalized block stream and network health of Aletheia StableChain.</p>
  </div>
  <SearchBox />
</section>

{#if stats && !stats.online}
  <div class="container">
    <p class="offline panel"><Icon name="alert" size={16} /> The node is not answering. Figures below are the last ones seen; the page resumes on its own.</p>
  </div>
{/if}

<section class="tiles container" aria-label="Network figures">
  <StatTile icon="block" label="Latest block" value={stats ? `#${grouped(stats.height)}` : "—"} note="Epoch {grouped(stats?.epoch ?? 0)}" />
  <StatTile
    icon="activity"
    label="Total transactions"
    value={grouped(stats?.totalTxs ?? 0)}
    note={stats?.countedFromGenesis ? `Since genesis · ${grouped(stats.txsLastMinute)} in the last minute` : "Counting back to genesis…"}
  />
  <StatTile
    icon="shield"
    label="Validators"
    value="{stats?.validators ?? stats?.proposers ?? 0} active"
    note={stats?.validatorMode === "single-producer" ? `Single producer · ${stats?.network ?? "devnet"}` : `Recorded set · protocol version ${stats?.protocolVersion ?? 1}`}
  />
  <StatTile icon="vault" label="AEY outstanding" value={compactUnits(stats?.aeyOutstanding ?? null, "AEY")} unit="AEY" note="Aletheian Guilder, legal tender" />
</section>

<section class="streams container">
  <article class="stream panel" aria-labelledby="blocks-title">
    <header>
      <h2 id="blocks-title"><Star size={14} hole="var(--surface)" />Live Blocks Stream</h2>
      <span class="chip num">{blockTime}</span>
    </header>
    <div class="list">
      {#each live.blocks.slice(0, 8) as block (block.height)}
        <BlockRow {block} fresh={live.fresh.has(`b${block.height}`)} />
      {:else}
        <p class="empty">Waiting for the first finalized block…</p>
      {/each}
    </div>
    <a class="more" href="/blocks">View all blocks <Icon name="arrowRight" size={14} /></a>
  </article>

  <article class="stream panel" aria-labelledby="txs-title">
    <header>
      <h2 id="txs-title"><Star size={14} hole="var(--surface)" />Live Transactions Stream</h2>
      <span class="chip">AEY · ALnT transfers</span>
    </header>
    <div class="list">
      {#each live.txs.slice(0, 8) as tx (tx.txId)}
        <TxRow {tx} fresh={live.fresh.has(tx.txId)} />
      {:else}
        <p class="empty">No transactions yet. They appear here the moment their block is final.</p>
      {/each}
    </div>
    <a class="more" href="/transactions">View all transactions <Icon name="arrowRight" size={14} /></a>
  </article>
</section>

<style>
  .hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 3rem;
    padding-bottom: 2.25rem;
  }
  .watermark {
    position: absolute;
    top: -5.5rem;
    right: -3rem;
    opacity: 0.07;
    pointer-events: none;
    z-index: -1;
  }
  .title {
    position: relative;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  h1 {
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.1;
  }
  .lede {
    margin-top: 0.6rem;
    font-size: var(--fs-base);
    color: var(--text-soft);
  }
  .offline {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    font-size: var(--fs-sm);
    color: var(--warn);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
  .streams {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin-top: 1.5rem;
  }
  .stream {
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    min-width: 0;
  }
  .stream header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.25rem 0.25rem 1rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--fs-md);
    font-weight: 800;
    letter-spacing: -0.015em;
  }
  .chip {
    padding: 0.25rem 0.65rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.5rem;
    white-space: nowrap;
  }
  .list {
    display: grid;
    gap: 0.625rem;
  }
  .empty {
    padding: 2.5rem 1rem;
    text-align: center;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .more {
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    padding: 0.5rem 0.9rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--brand-gold-bright);
    border: 1px solid transparent;
    border-radius: 0.5rem;
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease);
  }
  .more:hover {
    background: rgb(196 154 78 / 0.1);
    border-color: rgb(196 154 78 / 0.4);
  }
  @media (max-width: 68rem) {
    .tiles {
      grid-template-columns: repeat(2, 1fr);
    }
    .streams {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 48rem) {
    .hero {
      flex-direction: column;
      align-items: stretch;
      padding-top: 2rem;
    }
    h1 {
      font-size: var(--fs-xl);
    }
    .watermark {
      display: none;
    }
  }
  @media (max-width: 30rem) {
    .tiles {
      grid-template-columns: 1fr;
    }
  }
</style>
