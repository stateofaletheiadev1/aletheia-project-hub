<script lang="ts">
  import Ident from "$lib/components/Ident.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ScanPager from "$lib/components/ScanPager.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import Star from "$lib/components/Star.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import { useLive } from "$lib/context";
  import { age, grouped, stamp } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();

  // Page 1 follows the chain live; other pages are fixed ranges of height.
  const blocks = $derived(data.live && live.blocks.length >= 25 ? live.blocks.slice(0, 25) : data.blocks);
  const head = $derived(data.live ? Math.max(data.head, live.stats?.height ?? 0) : data.head);
  const pages = $derived(Math.max(1, Math.ceil((head + 1) / 25)));
  const now = $derived(live.now || (blocks[0]?.protocolTimeMs ?? 0));
  const bottom = $derived(blocks.at(-1)?.height ?? 0);
  const top = $derived(blocks[0]?.height ?? 0);
  const recentTxs = $derived(live.blocks.slice(0, 120).reduce((sum, b) => sum + b.txCount, 0));
  const pace = $derived(live.stats?.avgBlockMs ? `${(live.stats.avgBlockMs / 1000).toFixed(1)} s` : "—");

  let showDate = $state(false);
  const href = (p: number) => (p === 1 ? "/blocks" : `/blocks?p=${p}`);
</script>

<svelte:head><title>Blocks · Aletheia Explorer</title></svelte:head>

<PageHead eyebrow="Ledger · finalized blocks" title="Blocks" />

<section class="container cards" aria-label="Block figures">
  <StatTile icon="block" label="Latest block" value="#{grouped(head)}" note="Epoch {grouped(live.stats?.epoch ?? 0)}" />
  <StatTile icon="clock" label="Block time" value={pace} note="Average of the last 20 blocks" />
  <StatTile
    icon="shield"
    label="Validators"
    value="{live.stats?.validators ?? live.stats?.proposers ?? 0} active"
    note={live.stats?.validatorMode === "single-producer" ? `Single producer · ${live.stats?.network ?? "devnet"}` : `Recorded set · protocol version ${live.stats?.protocolVersion ?? 1}`}
  />
  <StatTile icon="activity" label="Transactions" value={grouped(recentTxs)} note="In the latest {grouped(Math.min(120, live.blocks.length))} blocks" />
</section>

<section class="container">
  <article class="panel register">
    <div class="bar">
      <div>
        <p class="total">
          Block #{grouped(bottom)} to #{grouped(top)} <span class="faint">(Total of {grouped(head + 1)} blocks)</span>
        </p>
        <p class="sub">Every block listed is final: it can never be reverted.</p>
      </div>
      <ScanPager
        page={data.page}
        {pages}
        first={data.page > 1 ? href(1) : null}
        prev={data.page > 1 ? href(data.page - 1) : null}
        next={data.page < pages ? href(data.page + 1) : null}
        last={data.page < pages ? href(pages) : null}
      />
    </div>

    <div class="scan-wrap">
      <table class="scan">
        <thead>
          <tr>
            <th scope="col">Block</th>
            <th scope="col">
              <button type="button" class="th-toggle" onclick={() => (showDate = !showDate)} title="Switch between age and date">
                {showDate ? "Date Time (UTC)" : "Age"}
              </button>
            </th>
            <th scope="col">Txn</th>
            <th scope="col">Validator</th>
            <th scope="col">Epoch · Slot</th>
            <th scope="col" class="r">EU Used</th>
            <th scope="col">Block Hash</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each blocks as block (block.height)}
            <tr class:fresh={data.live && live.fresh.has(`b${block.height}`)}>
              <td><a class="cell-link num" href="/blocks/{block.height}">{grouped(block.height)}</a></td>
              <td class="faint num">{showDate ? stamp(block.protocolTimeMs) : age(block.protocolTimeMs, now)}</td>
              <td>
                {#if block.txCount > 0}
                  <a class="cell-link num" href="/blocks/{block.height}?tab=transactions">{grouped(block.txCount)}</a>
                {:else}<span class="faint">0</span>{/if}
              </td>
              <td>Validator {block.proposer}</td>
              <td class="faint num">{grouped(block.epoch)} · {grouped(block.slot)}</td>
              <td class="r num">{grouped(block.euUsed)}</td>
              <td>
                <span class="hash-cell">
                  <a class="cell-link" href="/blocks/{block.height}"><Ident value={block.id} /></a>
                  <CopyButton value={block.id} label="Copy block ID" />
                </span>
              </td>
              <td><span class="final"><Star size={10} /> Finalized</span></td>
            </tr>
          {:else}
            <tr><td colspan="8" class="empty">No blocks in this range.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="foot">
      <span class="faint">Show 25 records per page</span>
      <ScanPager
        page={data.page}
        {pages}
        first={data.page > 1 ? href(1) : null}
        prev={data.page > 1 ? href(data.page - 1) : null}
        next={data.page < pages ? href(data.page + 1) : null}
        last={data.page < pages ? href(pages) : null}
      />
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
  .register {
    padding: 0.5rem 0 0.75rem;
  }
  .bar,
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1rem 1.25rem;
  }
  .foot {
    padding-top: 1rem;
    padding-bottom: 0.5rem;
  }
  .total {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .sub {
    margin-top: 0.2rem;
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .faint {
    color: var(--text-faint);
    font-weight: 500;
    font-size: var(--fs-xs);
  }
  .hash-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
  }
  .final {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.18rem 0.5rem 0.18rem 0.4rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.375rem;
  }
  .empty {
    padding: 2.5rem;
    text-align: center;
    color: var(--text-faint);
  }
  @media (max-width: 68rem) {
    .cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 30rem) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
</style>
