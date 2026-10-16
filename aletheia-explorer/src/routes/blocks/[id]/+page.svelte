<script lang="ts">
  import BackLink from "$lib/components/BackLink.svelte";
  import Seal from "$lib/components/Seal.svelte";
  import Ident from "$lib/components/Ident.svelte";
  import Blazon from "$lib/components/Blazon.svelte";
  import Amount from "$lib/components/Amount.svelte";
  import { goto } from "$app/navigation";
  import Badge from "$lib/components/Badge.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Overview from "$lib/components/Overview.svelte";
  import Row from "$lib/components/Row.svelte";
  import Star from "$lib/components/Star.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { useLive } from "$lib/context";
  import { age, amountText, dateTimeUtc, grouped, typeLabel } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();
  const block = $derived(data.block);
  const head = $derived(Math.max(data.head, live.stats?.height ?? 0));
  const prev = $derived(block.height > 0 ? block.height - 1 : null);
  const next = $derived(block.height < head ? block.height + 1 : null);
  const confirmations = $derived(Math.max(0, head - block.height));
  const now = $derived(live.now || block.protocolTimeMs);
  const fees = $derived(data.txs.reduce((sum, t) => sum + (t.feeAsset === "ALnT" ? BigInt(t.fee) : 0n), 0n).toString());
  const self = $derived(`/blocks/${block.height}`);
  let more = $state(false);

  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === "INPUT" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft" && prev !== null) void goto(`/blocks/${prev}${data.tab === "transactions" ? "?tab=transactions" : ""}`);
    if (event.key === "ArrowRight" && next !== null) void goto(`/blocks/${next}${data.tab === "transactions" ? "?tab=transactions" : ""}`);
  }
</script>

<svelte:head><title>Block #{grouped(block.height)} · Aletheia Explorer</title></svelte:head>
<svelte:window onkeydown={onKey} />

<BackLink href="/blocks" label="All blocks" />

<section class="head container">
  <div>
    <p class="eyebrow">Ledger · block</p>
    <h1>Block <span class="num">#{grouped(block.height)}</span></h1>
    <p class="lede">Final at {dateTimeUtc(block.protocolTimeMs)} · proposed by Validator {block.proposer}</p>
  </div>
  <figure class="seal" title="The seal of block #{grouped(block.height)}, engraved from its hash. Ornament, never proof.">
    <Seal id={block.id} size={104} />
    <figcaption>Block seal</figcaption>
  </figure>
</section>

<section class="container">
  <Tabs
    current={data.tab}
    tabs={[
      { id: "overview", label: "Overview", href: self },
      { id: "transactions", label: `Transactions (${grouped(block.txCount)})`, href: `${self}?tab=transactions` },
    ]}
  />

  {#if data.tab === "overview"}
    <article class="panel card">
      <Overview>
        <Row label="Block Height" hint="The block's position in the chain, counted from genesis at 0.">
          <span class="line">
            <strong class="num">{grouped(block.height)}</strong>
            {#if prev !== null}<a class="step" href="/blocks/{prev}" aria-label="Previous block" title="Previous block (←)"><Icon name="chevronLeft" size={13} stroke={2.4} /></a>{/if}
            {#if next !== null}<a class="step" href="/blocks/{next}" aria-label="Next block" title="Next block (→)"><Icon name="chevronRight" size={13} stroke={2.4} /></a>{/if}
          </span>
        </Row>
        <Row label="Status" hint="Every block shown is final: it carries the network's finality and can never be reverted.">
          <span class="line">
            <Badge tone="final"><Star size={10} /> Finalized</Badge>
            <span class="faint num">{grouped(confirmations)} Block Confirmations</span>
          </span>
        </Row>
        <Row label="Timestamp" hint="Protocol time of the block, in UTC.">
          <span class="line soft"><Icon name="clock" size={14} /> {age(block.protocolTimeMs, now)} ({dateTimeUtc(block.protocolTimeMs)})</span>
        </Row>
        <Row label="Proposed On" hint="The slot the block was proposed in, and its epoch.">
          <span class="num">Slot {grouped(block.slot)} · Epoch {grouped(block.epoch)}</span>
        </Row>
        <Row label="Transactions" hint="Transactions included in this block.">
          {#if block.txCount > 0}
            <a class="pill" href="{self}?tab=transactions">{grouped(block.txCount)} {block.txCount === 1 ? "transaction" : "transactions"}</a>
            <span class="faint">in this block</span>
          {:else}
            <span class="faint">No transactions in this block</span>
          {/if}
        </Row>
        <hr />
        <Row label="Validator" hint="The validator that proposed the block.">Validator {block.proposer}</Row>
        <Row label="EU Used" hint="Execution units used by every transaction in the block.">
          <span class="num">{grouped(block.euUsed)}</span>
        </Row>
        <Row label="Fees" hint="Fees paid by the block's transactions, to the fee pool.">
          <Amount units={fees} asset="ALnT" />
        </Row>
        <Row label="Protocol Version" hint="The rules this block was executed under.">Version {block.protocolVersion}</Row>
        {#if more}
          <hr />
          <Row label="Hash" hint="The block's identifier: a hash of its header.">
            <span class="line"><Ident value={block.id} full /> <CopyButton value={block.id} label="Copy block ID" /></span>
          </Row>
          <Row label="Parent Hash" hint="The block this one extends.">
            {#if block.height > 0}
              <span class="line"><a class="link" href="/blocks/{block.height - 1}"><Ident value={block.parent} full /></a> <CopyButton value={block.parent} /></span>
            {:else}<span class="faint">Genesis has no parent</span>{/if}
          </Row>
          <Row label="State Root" hint="Root of the Merkle tree of all state after this block.">
            <span class="line"><span class="faint"><Ident value={block.stateRoot} full /></span> <CopyButton value={block.stateRoot} /></span>
          </Row>
          <Row label="Transactions Root" hint="Merkle root of the block's transactions.">
            <span class="line"><span class="faint"><Ident value={block.txRoot} full /></span> <CopyButton value={block.txRoot} /></span>
          </Row>
          <Row label="Receipts Root" hint="Merkle root of the transactions' receipts.">
            <span class="line"><span class="faint"><Ident value={block.receiptRoot} full /></span> <CopyButton value={block.receiptRoot} /></span>
          </Row>
          <Row label="Events Root" hint="Merkle root of every event the block emitted.">
            <span class="line"><span class="faint"><Ident value={block.eventRoot} full /></span> <CopyButton value={block.eventRoot} /></span>
          </Row>
          <Row label="Finality Certificate" hint="The quorum certificate that made the block final.">
            {#if data.finality}
              <span class="line num">{grouped(data.finality.bytes)} bytes <CopyButton value={data.finality.proof} label="Copy the certificate" /></span>
            {:else}
              <span class="faint">Not stored: on this network a single producer finalizes its own blocks.</span>
            {/if}
          </Row>
        {/if}
      </Overview>
      <button type="button" class="more" onclick={() => (more = !more)} aria-expanded={more}>
        <Icon name={more ? "chevronLeft" : "chevronRight"} size={13} stroke={2.2} />
        {more ? "Click to show less" : "Click to show more"}
      </button>
    </article>
  {:else}
    <article class="panel register">
      <div class="bar">
        <p class="total">A total of {grouped(block.txCount)} {block.txCount === 1 ? "transaction" : "transactions"} found</p>
      </div>
      <div class="scan-wrap">
        <table class="scan">
          <thead>
            <tr>
              <th scope="col">Transaction Hash</th>
              <th scope="col">Method</th>
              <th scope="col">Position</th>
              <th scope="col">From</th>
              <th scope="col" class="arrow-col"><span class="visually-hidden">Direction</span></th>
              <th scope="col">To</th>
              <th scope="col" class="r">Value</th>
              <th scope="col" class="r">Txn Fee</th>
            </tr>
          </thead>
          <tbody>
            {#each data.txs as tx, i (tx.txId)}
              {@const fee = amountText(tx.fee, tx.feeAsset)}
              <tr>
                <td>
                  <span class="hash-cell">
                    {#if !tx.ok}<span class="failed" title="Failed"><Icon name="alert" size={13} /></span>{/if}
                    <a class="cell-link" href="/tx/{encodeURIComponent(tx.txId)}"><Ident value={tx.txId} /></a>
                    <CopyButton value={tx.txId} label="Copy transaction ID" />
                  </span>
                </td>
                <td><span class="method">{typeLabel(tx.type)}</span></td>
                <td class="faint num">{i}</td>
                <td><a class="cell-link party" href="/address/{encodeURIComponent(tx.sender)}"><Blazon address={tx.sender} size={14} /><Ident value={tx.sender} head={4} tail={4} /></a></td>
                <td class="arrow-col"><span class="arrow"><Icon name="arrowRight" size={12} stroke={2.2} /></span></td>
                <td>
                  {#if tx.recipient}<a class="cell-link party" href="/address/{encodeURIComponent(tx.recipient)}"><Blazon address={tx.recipient} size={14} /><Ident value={tx.recipient} head={4} tail={4} /></a>
                  {:else}<span class="faint">—</span>{/if}
                </td>
                <td class="r num value">{#if tx.amount !== null && tx.asset !== null}<Amount units={tx.amount} asset={tx.asset} />{:else}<span class="faint">0</span>{/if}</td>
                <td class="r num faint">{fee.text} {tx.feeAsset}</td>
              </tr>
            {:else}
              <tr><td colspan="8" class="empty">This block carries no transactions. A block is produced every slot, with or without them.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if block.txCount > data.txs.length}
        <p class="empty">Showing the first {grouped(data.txs.length)} of {grouped(block.txCount)}.</p>
      {/if}
    </article>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 0.9rem;
    padding-bottom: 1.25rem;
  }
  .lede {
    margin-top: 0.45rem;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .seal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
  }
  .seal figcaption {
    font-size: var(--fs-2xs);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  @media (max-width: 36rem) {
    .seal {
      display: none;
    }
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  h1 .num {
    color: var(--text-soft);
  }
  .card {
    padding: 0.75rem 1.5rem 1rem;
  }
  .register {
    padding: 0.5rem 0 0.75rem;
  }
  .bar {
    padding: 1rem 1.25rem;
  }
  .total {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .line {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }
  .soft {
    color: var(--text-soft);
  }
  .link {
    color: var(--accent);
    transition: color var(--quick) var(--ease);
  }
  .link:hover {
    color: var(--text);
  }
  .faint {
    color: var(--text-faint);
    font-weight: 500;
  }
  .step {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.35rem;
    transition: border-color var(--quick) var(--ease);
  }
  .step:hover {
    border-color: var(--brand-gold);
  }
  .pill {
    display: inline-block;
    padding: 0.18rem 0.6rem;
    margin-right: 0.35rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--accent);
    background: rgb(143 227 255 / 0.08);
    border: 1px solid rgb(143 227 255 / 0.3);
    border-radius: 0.4rem;
  }
  .pill:hover {
    color: var(--text);
  }
  .more {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.4rem;
    padding: 0.35rem 0;
    border: 0;
    background: none;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--brand-gold-bright);
    cursor: pointer;
  }
  .more:hover {
    color: var(--text);
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
  .empty {
    padding: 2rem 1rem;
    text-align: center;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
</style>
