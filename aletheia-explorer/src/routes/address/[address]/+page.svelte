<script lang="ts">
  import Hash from "$lib/components/Hash.svelte";
  import Star from "$lib/components/Star.svelte";
  import TxRow from "$lib/components/TxRow.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { useLive } from "$lib/context";
  import { amountText, grouped } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();
  const address = $derived(data.account.address);
  // Recent activity keeps following the chain while the page is open.
  const recent = $derived(
    live.txs.length > 0 ? live.txs.filter((t) => t.sender === address || t.recipient === address) : data.recent,
  );
  const names: Record<string, string> = { AEY: "Aletheian Guilder", ALnT: "Aletheia Talent" };
</script>

<svelte:head><title>Address {address.slice(0, 12)}… · Aletheia Explorer</title></svelte:head>

<section class="head container">
  <p class="eyebrow"><Star size={11} hole="var(--bg)" /> Address</p>
  <h1>Account</h1>
  <div class="id"><Hash value={address} /></div>
  <p class="lede">
    {#if data.account.exists}
      Active account · {grouped(data.account.nonce)} {data.account.nonce === 1 ? "transaction" : "transactions"} sent
    {:else}
      No transactions sent yet. The address can still receive.
    {/if}
  </p>
</section>

<section class="container balances">
  {#each data.balances as balance (balance.asset)}
    {@const available = amountText(balance.available, balance.asset)}
    {@const locked = amountText(balance.locked, balance.asset)}
    <article class="panel balance">
      <div class="top">
        <span class="plate"><Icon name="vault" size={18} /></span>
        <div>
          <span class="label">{names[balance.asset] ?? balance.asset}</span>
          <p class="figure num" title="{available.exact} {balance.asset}">{available.text}<span class="asset">{balance.asset}</span></p>
        </div>
      </div>
      <p class="sub num">
        {#if balance.locked !== "0"}Locked {locked.text} {balance.asset} · {/if}At block {grouped(balance.height)}
      </p>
    </article>
  {/each}
</section>

<section class="container">
  <article class="panel activity">
    <header>
      <h2><Star size={14} hole="var(--surface)" /> Recent activity</h2>
      <span class="note">Seen by this explorer in the latest blocks</span>
    </header>
    <div class="list">
      {#each recent as tx (tx.txId)}
        <TxRow {tx} fresh={live.fresh.has(tx.txId)} />
      {:else}
        <p class="empty">No transfers from or to this address in the latest blocks.</p>
      {/each}
    </div>
  </article>
</section>

<style>
  .head {
    padding-top: 2.75rem;
    padding-bottom: 1.75rem;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
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
  .id {
    margin-top: 0.6rem;
  }
  .lede {
    margin-top: 0.6rem;
    font-size: var(--fs-sm);
    color: var(--text-soft);
  }
  .balances {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
  }
  .balance {
    padding: 1.3rem 1.4rem;
  }
  .top {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .plate {
    display: grid;
    place-items: center;
    width: 2.875rem;
    height: 2.875rem;
    flex: none;
    border-radius: 0.75rem;
    color: var(--brand-gold-bright);
    background: linear-gradient(160deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.6);
  }
  .figure {
    margin-top: 0.2rem;
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .asset {
    margin-left: 0.45rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--gold);
  }
  .sub {
    margin-top: 0.9rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgb(255 255 255 / 0.07);
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .activity {
    margin-top: 1.25rem;
    padding: 1.25rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
  }
  .note {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .list {
    display: grid;
    gap: 0.625rem;
  }
  .empty {
    padding: 2rem 1rem;
    text-align: center;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
</style>
