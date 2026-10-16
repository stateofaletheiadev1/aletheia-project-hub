<script lang="ts">
  import Ident from "$lib/components/Ident.svelte";
  import Blazon from "$lib/components/Blazon.svelte";
  import Amount from "$lib/components/Amount.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ScanPager from "$lib/components/ScanPager.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import { useLive } from "$lib/context";
  import { age, amountText, grouped, stamp, typeLabel } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();

  // Page 1 follows the chain live; older pages are fixed.
  const txs = $derived(data.live && live.txs.length >= data.txs.length ? live.txs.slice(0, 25) : data.txs);
  const now = $derived(live.now || (txs[0]?.timeMs ?? 0));
  const total = $derived(live.stats?.totalTxs ?? 0);
  const recent = $derived(live.txs);
  const avgFee = $derived.by(() => {
    const fees = recent.filter((t) => t.feeAsset === "ALnT").map((t) => BigInt(t.fee));
    if (fees.length === 0) return "—";
    return amountText((fees.reduce((a, b) => a + b, 0n) / BigInt(fees.length)).toString(), "ALnT").text;
  });
  const success = $derived(recent.length === 0 ? "—" : `${Math.round((100 * recent.filter((t) => t.ok).length) / recent.length)}%`);

  let showDate = $state(false);
</script>

<svelte:head><title>Transactions · Aletheia Explorer</title></svelte:head>

<PageHead eyebrow="Ledger · settled transactions" title="Transactions" />

<section class="container cards" aria-label="Transaction figures">
  <StatTile icon="activity" label="Transactions" value={grouped(total)} note={live.stats?.countedFromGenesis ? "Since genesis" : "Counting back to genesis…"} />
  <StatTile icon="clock" label="Last minute" value={grouped(live.stats?.txsLastMinute ?? 0)} note="Settled in finalized blocks" />
  <StatTile icon="vault" label="Average fee" value={avgFee} unit="ALnT" note="Over the latest {grouped(recent.length)} transactions" />
  <StatTile icon="shield" label="Success rate" value={success} note="Of the latest {grouped(recent.length)} transactions" />
</section>

<section class="container">
  <article class="panel register">
    <div class="bar">
      <div>
        <p class="total">
          {#if data.live}More than {grouped(total)} transactions found{:else}Transactions in blocks {grouped(txs.at(-1)?.height ?? 0)} – {grouped(txs[0]?.height ?? 0)}{/if}
        </p>
        <p class="sub">(Showing the {data.live ? "latest" : ""} {grouped(txs.length)} records)</p>
      </div>
      <ScanPager
        page={data.page}
        first={data.live ? null : "/transactions"}
        prev={data.live ? null : "/transactions"}
        next={data.older !== null ? `/transactions?before=${data.older}&p=${data.page + 1}` : null}
      />
    </div>

    <div class="scan-wrap">
      <table class="scan">
        <thead>
          <tr>
            <th scope="col">Transaction Hash</th>
            <th scope="col">Method</th>
            <th scope="col">Block</th>
            <th scope="col">
              <button type="button" class="th-toggle" onclick={() => (showDate = !showDate)} title="Switch between age and date">
                {showDate ? "Date Time (UTC)" : "Age"}
              </button>
            </th>
            <th scope="col">From</th>
            <th scope="col" class="arrow-col"><span class="visually-hidden">Direction</span></th>
            <th scope="col">To</th>
            <th scope="col" class="r">Value</th>
            <th scope="col" class="r">Txn Fee</th>
          </tr>
        </thead>
        <tbody>
          {#each txs as tx (tx.txId)}
            {@const fee = amountText(tx.fee, tx.feeAsset)}
            <tr class:fresh={data.live && live.fresh.has(tx.txId)}>
              <td>
                <span class="hash-cell">
                  {#if !tx.ok}<span class="failed" title="Failed"><Icon name="alert" size={13} /></span>{/if}
                  <a class="cell-link" href="/tx/{encodeURIComponent(tx.txId)}"><Ident value={tx.txId} /></a>
                  <CopyButton value={tx.txId} label="Copy transaction ID" />
                </span>
              </td>
              <td><span class="method" title={typeLabel(tx.type)}>{typeLabel(tx.type)}</span></td>
              <td><a class="cell-link num" href="/blocks/{tx.height}">{grouped(tx.height)}</a></td>
              <td class="faint num">{showDate ? stamp(tx.timeMs) : age(tx.timeMs, now)}</td>
              <td>
                <a class="cell-link party" href="/address/{encodeURIComponent(tx.sender)}"><Blazon address={tx.sender} size={14} /><Ident value={tx.sender} head={4} tail={4} /></a>
              </td>
              <td class="arrow-col"><span class="arrow" aria-label="to"><Icon name="arrowRight" size={12} stroke={2.2} /></span></td>
              <td>
                {#if tx.recipient}
                  <a class="cell-link party" href="/address/{encodeURIComponent(tx.recipient)}"><Blazon address={tx.recipient} size={14} /><Ident value={tx.recipient} head={4} tail={4} /></a>
                  {#if tx.legs > 1}<span class="faint"> +{tx.legs - 1}</span>{/if}
                {:else}<span class="faint">—</span>{/if}
              </td>
              <td class="r num value">
                {#if tx.amount !== null && tx.asset !== null}<Amount units={tx.amount} asset={tx.asset} />{:else}<span class="faint">0</span>{/if}
              </td>
              <td class="r num faint" title="{fee.exact} {tx.feeAsset}">{fee.text} {tx.feeAsset}</td>
            </tr>
          {:else}
            <tr><td colspan="9" class="empty">No transactions in this stretch of the chain.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="foot">
      {#if data.reachedGenesis}
        <span class="genesis">The beginning of the ledger: the genesis block.</span>
      {:else}
        <span class="faint">Show 25 records per page</span>
      {/if}
      <ScanPager
        page={data.page}
        first={data.live ? null : "/transactions"}
        prev={data.live ? null : "/transactions"}
        next={data.older !== null ? `/transactions?before=${data.older}&p=${data.page + 1}` : null}
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
    padding-bottom: 0.5rem;
  }
  .total {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .sub,
  .faint {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .sub {
    margin-top: 0.2rem;
  }
  .hash-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .failed {
    display: inline-flex;
    color: var(--fail);
  }
  .arrow-col {
    width: 2rem;
    padding-left: 0;
    padding-right: 0;
    text-align: center;
  }
  /* PolygonScan's direction mark, in laurel green. */
  .arrow {
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
  }
  .value {
    font-weight: 700;
  }
  .genesis {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--fs-xs);
    color: var(--brand-gold-bright);
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
