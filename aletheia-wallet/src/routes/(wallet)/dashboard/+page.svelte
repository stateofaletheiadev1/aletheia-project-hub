<script lang="ts">
  // The private ledger at a glance (wallet prompt 8.1): the AEY balance as the denomination, ALnT
  // as a secondary denomination, "as of finalized block N", Send/Receive, recent activity, and a
  // quiet status line. No fiat, no chart, no percentage.
  import Denomination from "$lib/components/data/Denomination.svelte";
  import AssetRoundel from "$lib/components/data/AssetRoundel.svelte";
  import ActivityLedger from "$lib/components/data/ActivityLedger.svelte";
  import Timestamp from "$lib/components/data/Timestamp.svelte";
  import RuledSkeleton from "$lib/components/feedback/RuledSkeleton.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import ErrorSheet from "$lib/components/feedback/ErrorSheet.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { ASSETS } from "$lib/stablechain/assets/assets";
  import { groupWhole } from "$lib/formatting/amount";
  import { ledger } from "$lib/state/ledger.svelte";
  import { session } from "$lib/state/session.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { explorer } from "$lib/config";

  const snapshot = $derived(ledger.snapshot);
  const recent = $derived(ledger.activity.slice(0, 7));
</script>

<svelte:head><title>Ledger · Aletheia Wallet</title></svelte:head>

<div class="dashboard">
  <header class="title-row settle" style:--settle-order="0">
    <div>
      <p class="eyebrow">{session.active?.name ?? "Account"} · Private ledger</p>
      <h1 class="visually-hidden">Ledger</h1>
    </div>
  </header>

  {#if ledger.loading && !snapshot}
    <section class="hero"><RuledSkeleton rows={3} label="Reading balances" /></section>
  {:else if snapshot}
    <section class="hero" aria-label="Balances">
      <div class="primary settle" style:--settle-order="1">
        <p class="eyebrow asset-label"><AssetRoundel asset="AEY" size={28} /> AEY · {ASSETS.AEY.name}</p>
        <Denomination units={snapshot.AEY.available} decimals={ASSETS.AEY.decimals} size="hero" announce />
        <dl class="sub">
          <div>
            <dt class="eyebrow">Available</dt>
            <dd><Denomination units={snapshot.AEY.available} decimals={18} code="AEY" /></dd>
          </div>
          {#if snapshot.AEY.locked > 0n}
            <div>
              <dt class="eyebrow">Locked</dt>
              <dd><Denomination units={snapshot.AEY.locked} decimals={18} code="AEY" /></dd>
            </div>
          {/if}
        </dl>
      </div>
      <div class="secondary settle" style:--settle-order="2">
        <p class="eyebrow asset-label"><AssetRoundel asset="ALnT" size={28} /> ALnT · {ASSETS.ALnT.name}</p>
        <Denomination units={snapshot.ALnT.available} decimals={ASSETS.ALnT.decimals} size="secondary" announce />
        <dl class="sub">
          <div>
            <dt class="eyebrow">Available</dt>
            <dd><Denomination units={snapshot.ALnT.available} decimals={3} code="ALnT" /></dd>
          </div>
          {#if snapshot.ALnT.locked > 0n}
            <div>
              <dt class="eyebrow">Locked</dt>
              <dd><Denomination units={snapshot.ALnT.locked} decimals={3} code="ALnT" /></dd>
            </div>
          {/if}
          <div>
            <dt class="eyebrow">Use</dt>
            <dd class="micro">Network fees and staking</dd>
          </div>
        </dl>
      </div>
      <p class="as-of micro settle" style:--settle-order="3">
        <Icon name="seal" size={14} /> As of finalized block
        <span class="numerals">{groupWhole(snapshot.height, prefs.locale)}</span>
        · <Timestamp ms={snapshot.at} mode="absolute" />
        {#if ledger.problem}<span class="stale"> · showing the last state read; the node is not answering</span>{/if}
      </p>
    </section>
  {:else if ledger.problem}
    <section class="hero">
      <ErrorSheet title={ledger.problem.title} body={ledger.problem.body} technical={ledger.problem.technical} />
    </section>
  {/if}

  <nav class="actions settle" style:--settle-order="4" aria-label="Transfer">
    <Button variant="primary" href="/send" icon="send">Send</Button>
    <Button variant="quiet" href="/receive" icon="receive">Receive</Button>
  </nav>

  <section class="recent settle" style:--settle-order="5" aria-labelledby="recent-title">
    <div class="section-head">
      <h2 id="recent-title">Recent activity</h2>
      {#if ledger.activity.length}<a href="/activity" class="more">All activity <Icon name="chevron" size={16} /></a
        >{/if}
    </div>
    {#if recent.length}
      <ActivityLedger rows={recent} />
    {:else}
      <EmptyState scene="ledger" title="No transfers yet">
        Transfers you send from this wallet, and those that arrive while it is open, are written here.
        {#snippet actions()}
          <Button variant="quiet" href="/receive" icon="receive">Show my address</Button>
        {/snippet}
      </EmptyState>
    {/if}
  </section>

  <footer class="disclosure micro">
    <p>
      AEY is the settlement unit of AletheiaChain; its issuance is governed by the Reserve Bank of Aletheia. ALnT is the
      network's utility asset. Balances are read from the chain and shown exactly.
    </p>
    {#if session.active}
      <a href={explorer.address(session.active.address)} target="_blank" rel="noopener noreferrer"
        >This account on the Explorer <Icon name="external" size={14} /></a
      >
    {/if}
  </footer>
</div>

<style>
  .dashboard {
    display: grid;
    gap: var(--space-10);
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    column-gap: var(--space-12);
    row-gap: var(--space-6);
    align-items: start;
    padding-bottom: var(--space-8);
    border-bottom: var(--hairline) solid var(--rule-strong);
  }

  .primary,
  .secondary {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .secondary {
    padding-inline-start: var(--space-8);
    border-inline-start: var(--hairline) solid var(--rule-hairline);
  }

  .asset-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sub {
    display: grid;
    margin-top: var(--space-2);
  }

  .sub div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-4);
    min-height: 40px;
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .sub dd {
    margin: 0;
    font-size: var(--type-data);
  }

  .as-of {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }

  .as-of :global(.icon) {
    color: var(--state-verified);
  }

  .stale {
    color: var(--state-pending);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .actions :global(.button) {
    min-width: 160px;
    min-height: 52px;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: var(--type-title-track);
  }

  .more {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    color: var(--ink-heading);
  }

  .disclosure {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-3) var(--space-8);
    padding-top: var(--space-5);
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .disclosure p {
    max-width: 70ch;
  }

  .disclosure a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--ink-secondary);
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }

    .secondary {
      padding-inline-start: 0;
      border-inline-start: 0;
      padding-top: var(--space-6);
      border-top: var(--hairline) solid var(--rule-hairline);
    }
  }
</style>
