<script lang="ts">
  import Amount from "$lib/components/Amount.svelte";
  import Ident from "$lib/components/Ident.svelte";
  import Blazon from "$lib/components/Blazon.svelte";
  import Badge from "$lib/components/Badge.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Overview from "$lib/components/Overview.svelte";
  import Row from "$lib/components/Row.svelte";
  import Star from "$lib/components/Star.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { useLive } from "$lib/context";
  import { EVENT_SCHEMAS } from "$lib/events";
  import { age, amountText, dateTimeUtc, grouped, typeLabel } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();
  const tx = $derived(data.tx);
  const receipt = $derived(data.receipt);
  const ok = $derived((tx.receipt?.status ?? receipt?.status ?? "SUCCESS") === "SUCCESS");
  const failure = $derived((tx.receipt?.errorName || receipt?.errorName || "").toLowerCase().replace(/_/g, " "));
  const legs = $derived(tx.transfers ?? (tx.transfer ? [tx.transfer] : []));
  const total = $derived(legs.length > 0 ? legs.reduce((sum, leg) => sum + BigInt(leg.amount), 0n).toString() : null);
  const asset = $derived(legs[0]?.asset ?? null);
  const value = $derived(total !== null && asset !== null ? amountText(total, asset) : null);
  const euUsed = $derived(tx.receipt?.euUsed ?? 0);
  const euShare = $derived(tx.fee.euLimit > 0 ? (100 * euUsed) / tx.fee.euLimit : 0);
  const head = $derived(Math.max(data.head, live.stats?.height ?? 0));
  const confirmations = $derived(Math.max(0, head - tx.block.height));
  const now = $derived(live.now || data.timeMs);
  const events = $derived(receipt?.events ?? []);
  const self = $derived(`/tx/${encodeURIComponent(tx.txId)}`);
  let more = $state(false);
</script>

<svelte:head><title>Transaction {tx.txId.slice(0, 14)}… · Aletheia Explorer</title></svelte:head>

<section class="head container">
  <p class="eyebrow">Ledger · transaction</p>
  <h1>Transaction Details</h1>
</section>

<section class="container">
  <Tabs
    current={data.tab}
    tabs={[
      { id: "overview", label: "Overview", href: self },
      { id: "logs", label: `Logs (${events.length})`, href: `${self}?tab=logs` },
    ]}
  />

  {#if data.tab === "overview"}
    <article class="panel card">
      <Overview>
        <Row label="Transaction Hash" hint="The transaction's identifier: a hash of its signed body, on this network.">
          <span class="line"><Ident value={tx.txId} full /> <CopyButton value={tx.txId} label="Copy transaction ID" /></span>
        </Row>
        <Row label="Status" hint="Whether the transaction did what it asked. A failed one still pays its fee.">
          {#if ok}<Badge tone="ok"><Icon name="check" size={12} stroke={2.4} /> Success</Badge>
          {:else}<Badge tone="fail"><Icon name="alert" size={12} /> Failed{failure ? `: ${failure}` : ""}</Badge>{/if}
        </Row>
        <Row label="Block" hint="The block that includes this transaction. Blocks are final as soon as they are shown.">
          <span class="line">
            <a class="link num" href="/blocks/{tx.block.height}">{grouped(tx.block.height)}</a>
            <Badge tone="final"><Star size={10} /> {grouped(confirmations)} Block Confirmations</Badge>
          </span>
        </Row>
        <Row label="Timestamp" hint="Protocol time of the block, in UTC.">
          <span class="line faint-strong"><Icon name="clock" size={14} /> {age(data.timeMs, now)} ({dateTimeUtc(data.timeMs)})</span>
        </Row>
        <hr />
        {#if value}
          <Row label="Transaction Action" hint="What the transaction did, in one line.">
            <span class="line action">
              <span class="method">{typeLabel(tx.type)}</span>
              <strong><Amount units={total ?? "0"} asset={asset ?? ""} /></strong>
              to
              {#if legs[0]}<a class="link party" href="/address/{encodeURIComponent(legs[0].recipient)}"><Blazon address={legs[0].recipient} size={14} /><Ident value={legs[0].recipient} head={4} tail={4} /></a>{/if}
              {#if legs.length > 1}<span class="faint">and {legs.length - 1} more</span>{/if}
            </span>
          </Row>
          <hr />
        {/if}
        <Row label="From" hint="The account that signed and sent the transaction.">
          <span class="line">
            <a class="link party" href="/address/{encodeURIComponent(tx.sender)}"><Blazon address={tx.sender} size={16} /><Ident value={tx.sender} full /></a>
            <CopyButton value={tx.sender} label="Copy address" />
          </span>
        </Row>
        <Row label="To" hint="The account that received the value.">
          {#if legs.length === 1 && legs[0]}
            <span class="line">
              <a class="link party" href="/address/{encodeURIComponent(legs[0].recipient)}"><Blazon address={legs[0].recipient} size={16} /><Ident value={legs[0].recipient} full /></a>
              <CopyButton value={legs[0].recipient} label="Copy address" />
            </span>
          {:else if legs.length > 1}
            <ol class="legs">
              {#each legs as leg, i (i)}
                <li>
                  <span class="num idx">{i + 1}</span>
                  <a class="link party" href="/address/{encodeURIComponent(leg.recipient)}"><Blazon address={leg.recipient} size={16} /><Ident value={leg.recipient} full /></a>
                  <Amount units={leg.amount} asset={leg.asset} />
                </li>
              {/each}
            </ol>
          {:else}
            <span class="faint">{typeLabel(tx.type)}, no recipient</span>
          {/if}
        </Row>
        <hr />
        <Row label="Value" hint="The amount moved, exact to the last unit.">
          {#if value && asset}<span class="value"><Amount units={total ?? "0"} {asset} /></span>
          {:else}<span class="faint">0</span>{/if}
        </Row>
        <Row label="Transaction Fee" hint="Execution units used × the fee asset's EU price; paid even if the transaction fails.">
          <Amount units={tx.receipt?.feeCharged ?? "0"} asset={tx.fee.asset} />
        </Row>
        <Row label="EU Limit & Usage by Txn" hint="Execution units the sender allowed, and how many the transaction used.">
          <span class="line num">
            {grouped(tx.fee.euLimit)} <span class="sep">|</span> {grouped(euUsed)} ({euShare.toFixed(euShare < 10 ? 1 : 0)}%)
            <span class="meter" aria-hidden="true"><span style:width="{Math.min(100, euShare)}%"></span></span>
          </span>
        </Row>
        <Row label="Max Fee" hint="The most the sender agreed to pay.">
          <Amount units={tx.fee.maxFee} asset={tx.fee.asset} />
        </Row>

        {#if more}
          <hr />
          <Row label="Nonce" hint="The sender's transaction counter: each nonce is used once."><span class="num">{grouped(tx.nonce)}</span></Row>
          <Row label="Position In Block" hint="Where the transaction sits in its block."><span class="num">{grouped(tx.block.index)}</span></Row>
          <Row label="Type" hint="The transaction type number, as the protocol defines it.">
            {typeLabel(tx.type)} <span class="faint num">(type {tx.txType})</span>
          </Row>
          <Row label="Valid Slots" hint="The sender limited the transaction to this range of slots.">
            <span class="num">{grouped(tx.validFromSlot)} – {grouped(tx.expirySlot)}</span>
          </Row>
          {#if receipt}
            <Row label="Write Set Hash" hint="Commitment to every state change the transaction made.">
              <span class="line"><span class="faint"><Ident value={receipt.writeSetHash} full /></span> <CopyButton value={receipt.writeSetHash} /></span>
            </Row>
          {/if}
        {/if}
      </Overview>
      <button type="button" class="more" onclick={() => (more = !more)} aria-expanded={more}>
        <Icon name={more ? "chevronLeft" : "chevronRight"} size={13} stroke={2.2} />
        {more ? "Click to show less" : "Click to show more"}
      </button>
    </article>
  {:else}
    <article class="panel card">
      <p class="logs-intro">Transaction receipt event logs ({events.length})</p>
      {#each events as event, i (i)}
        {@const known = EVENT_SCHEMAS[event.eventType]}
        <div class="log">
          <span class="log-idx num">{i}</span>
          <Overview>
            <Row label="Address"><span class="line"><a class="link party" href="/address/{encodeURIComponent(event.emitter)}"><Blazon address={event.emitter} size={16} /><Ident value={event.emitter} full /></a></span></Row>
            <Row label="Name">
              {#if known}<span class="event-name">{known.label}</span> <span class="faint mono">{known.schema}</span>{:else}<span class="faint">Unknown event</span>{/if}
            </Row>
            <Row label="Topics">
              <ol class="topics">
                <li><span class="tag num">0</span><span class="mono faint">{event.eventType}</span></li>
                {#each event.topics as topic, t (t)}
                  <li><span class="tag num">{t + 1}</span><span class="faint"><Ident value={topic} full /></span></li>
                {/each}
              </ol>
            </Row>
            {#if event.data}<Row label="Data"><span class="data mono">{event.data}</span></Row>{/if}
          </Overview>
        </div>
      {:else}
        <p class="faint">This transaction emitted no events.</p>
      {/each}
    </article>
  {/if}
</section>

<style>
  .head {
    padding-top: 2.75rem;
    padding-bottom: 1.25rem;
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
  .card {
    padding: 0.75rem 1.5rem 1rem;
  }
  .line {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }
  .mono {
    font-size: var(--fs-sm);
    word-break: break-all;
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
  .faint-strong {
    color: var(--text-soft);
  }
  .action strong {
    color: var(--text);
  }
  .method {
    display: inline-block;
    padding: 0.18rem 0.5rem;
    font-size: var(--fs-2xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.375rem;
  }
  .value {
    font-size: var(--fs-md);
    font-weight: 800;
  }
  .sep {
    color: var(--text-faint);
  }
  .meter {
    display: inline-block;
    width: 6rem;
    height: 0.35rem;
    border-radius: 1rem;
    background: rgb(255 255 255 / 0.1);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--brand-gold);
  }
  .legs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .legs li {
    display: grid;
    grid-template-columns: 1.7rem minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
  }
  .idx,
  .tag {
    display: inline-grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.35rem;
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
  .logs-intro {
    padding: 0.6rem 0 1rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    border-bottom: 1px solid rgb(196 154 78 / 0.25);
  }
  .log {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.9rem 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.07);
  }
  .log:last-child {
    border-bottom: 0;
  }
  .log-idx {
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    margin-top: 0.6rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
    border-radius: 50%;
  }
  .event-name {
    text-transform: capitalize;
  }
  .topics {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .topics li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .data {
    display: block;
    padding: 0.6rem 0.75rem;
    color: var(--text-soft);
    background: rgb(12 39 134 / 0.45);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.5rem;
  }
</style>
