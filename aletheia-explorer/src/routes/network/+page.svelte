<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import BarChart from "$lib/components/BarChart.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import { useLive } from "$lib/context";
  import { grouped } from "$lib/format/display";
  import type { Minute } from "$lib/server/follower";

  let { data } = $props();
  const live = useLive();

  // Refresh the history while the page is open.
  onMount(() => {
    const timer = setInterval(() => void invalidateAll(), 15_000);
    return () => clearInterval(timer);
  });

  const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16);
  const minutes = $derived(data.minutes as Minute[]);
  const latest = $derived(minutes.at(-1)?.t ?? 0);

  // The last 60 complete minutes, oldest first, with empty minutes shown as zero.
  const lastHour = $derived.by(() => {
    if (!latest) return [];
    const byT = new Map(minutes.map((m) => [m.t, m]));
    return Array.from({ length: 60 }, (_, i) => {
      const t = latest - (59 - i) * 60_000;
      return byT.get(t) ?? { t, blocks: 0, txs: 0, eu: 0 };
    });
  });
  // The last 24 hours by hour.
  const byHour = $derived.by(() => {
    if (!latest) return [];
    const hour = (t: number) => Math.floor(t / 3_600_000) * 3_600_000;
    const end = hour(latest);
    const sums = new Map<number, { txs: number; blocks: number; eu: number }>();
    for (const m of minutes) {
      const h = hour(m.t);
      if (h <= end - 24 * 3_600_000) continue;
      const s = sums.get(h) ?? { txs: 0, blocks: 0, eu: 0 };
      s.txs += m.txs;
      s.blocks += m.blocks;
      s.eu += m.eu;
      sums.set(h, s);
    }
    return Array.from({ length: 24 }, (_, i) => {
      const t = end - (23 - i) * 3_600_000;
      return { t, ...(sums.get(t) ?? { txs: 0, blocks: 0, eu: 0 }) };
    });
  });

  const hourTotals = $derived(lastHour.reduce((a, m) => ({ blocks: a.blocks + m.blocks, txs: a.txs + m.txs, eu: a.eu + m.eu }), { blocks: 0, txs: 0, eu: 0 }));
  const peak = $derived(lastHour.reduce((best, m) => (m.txs > best.txs ? m : best), { t: 0, txs: 0, blocks: 0, eu: 0 }));
  const span = $derived(minutes.length > 0 ? minutes.length : 0);
  const avgMs = $derived(live.stats?.avgBlockMs ?? null);
</script>

<svelte:head>
  <title>Network Analytics · Aletheia Explorer</title>
  <meta name="description" content="Block production, transactions and execution units on AletheiaChain, minute by minute and hour by hour." />
</svelte:head>

<PageHead
  eyebrow="Consensus & Staking"
  title="Network Analytics"
  lede="How the chain is working: blocks produced, transactions settled and the execution units they used, read from every finalized block."
/>

<section class="container cards" aria-label="The last hour">
  <StatTile icon="block" label="Blocks · last hour" value={grouped(hourTotals.blocks)} note="Expected: 7,200 at one per 500 ms" />
  <StatTile icon="activity" label="Transactions · last hour" value={grouped(hourTotals.txs)} note="Settled in finalized blocks" />
  <StatTile icon="clock" label="Block time" value={avgMs ? `${(avgMs / 1000).toFixed(2)} s` : "—"} note="Average of the last 20 blocks" />
  <StatTile icon="layers" label="Busiest minute" value={grouped(peak.txs)} unit="txs" note={peak.t ? `At ${hhmm(peak.t)} UTC` : "No transactions yet"} />
</section>

<section class="container grid">
  <article class="panel chart-panel wide">
    <header>
      <h2>Transactions per minute</h2>
      <span class="meta">Last 60 minutes of protocol time · UTC</span>
    </header>
    <BarChart caption="Transactions settled in each minute" unit="transactions" bars={lastHour.map((m) => ({ label: hhmm(m.t), value: m.txs, title: `${hhmm(m.t)} UTC` }))} />
  </article>

  <article class="panel chart-panel">
    <header>
      <h2>Transactions per hour</h2>
      <span class="meta">Last 24 hours</span>
    </header>
    <BarChart caption="Transactions settled in each hour" unit="transactions" bars={byHour.map((h) => ({ label: hhmm(h.t), value: h.txs, title: `${hhmm(h.t)} UTC` }))} height={180} />
  </article>

  <article class="panel chart-panel">
    <header>
      <h2>Blocks per minute</h2>
      <span class="meta">120 is a full minute of 500 ms slots</span>
    </header>
    <BarChart caption="Blocks finalized in each minute" unit="blocks" bars={lastHour.map((m) => ({ label: hhmm(m.t), value: m.blocks, title: `${hhmm(m.t)} UTC` }))} height={180} />
  </article>

  <article class="panel chart-panel wide">
    <header>
      <h2>Execution units per minute</h2>
      <span class="meta">The work the chain did; a transfer uses 2,000 units</span>
    </header>
    <BarChart caption="Execution units used in each minute" unit="EU" bars={lastHour.map((m) => ({ label: hhmm(m.t), value: m.eu, title: `${hhmm(m.t)} UTC` }))} />
  </article>

  <article class="panel explain wide">
    <h2>Reading these figures</h2>
    <div class="points">
      <div>
        <strong>Slots and blocks</strong>
        <span>A slot is 500 ms. When a slot passes without a block (a leader offline, a network delay), the next block simply comes a slot later; the chart then shows fewer than 120 blocks that minute.</span>
      </div>
      <div>
        <strong>Finality</strong>
        <span>A block is final when the block after it carries a quorum certificate: about a second after it was proposed. Only final blocks are counted here, so these figures never change.</span>
      </div>
      <div>
        <strong>Execution units</strong>
        <span>Every transaction pays for the units it uses at a fixed published price. Units measure work, not congestion: a busy minute uses more units but costs no more per unit.</span>
      </div>
      <div>
        <strong>Coverage</strong>
        <span>
          {#if data.complete}History covers every block since genesis ({grouped(span)} minutes of protocol time; the explorer keeps seven days).{:else}The explorer is still reading the chain back to genesis; older hours fill in as it does.{/if}
        </span>
      </div>
    </div>
  </article>
</section>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .chart-panel,
  .explain {
    padding: 1.3rem 1.5rem 1.4rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding-bottom: 0.9rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--fs-md);
    font-weight: 800;
  }
  .meta {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .explain h2 {
    padding-bottom: 0.9rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .points {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.8rem;
  }
  .points div {
    display: grid;
    gap: 0.35rem;
    padding: 1rem 1.1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  .points strong {
    color: var(--brand-gold-bright);
  }
  @media (max-width: 68rem) {
    .cards {
      grid-template-columns: repeat(2, 1fr);
    }
    .grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 40rem) {
    .cards,
    .points {
      grid-template-columns: 1fr;
    }
  }
</style>
