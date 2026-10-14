<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import SearchBox from "$lib/components/SearchBox.svelte";
  import Star from "$lib/components/Star.svelte";

  let { data } = $props();
</script>

<svelte:head><title>Search · Aletheia Explorer</title></svelte:head>

<section class="container wrap">
  <article class="panel card">
    <p class="eyebrow"><Star size={11} hole="var(--surface)" /> Search</p>
    {#if data.query}
      <h1>Nothing to open for <span class="mono">{data.query}</span></h1>
    {:else}
      <h1>Search the ledger</h1>
    {/if}
    <p class="message"><Icon name="alert" size={16} /> {data.message}</p>
    <SearchBox value={data.query} autofocus />
    <ul class="hints">
      <li><strong>1200</strong> or <strong>1,200</strong>: a block height</li>
      <li><strong class="mono">alt:T…</strong>: a transaction</li>
      <li><strong class="mono">alt:B…</strong>: a block</li>
      <li><strong class="mono">alt:…</strong>: an address</li>
    </ul>
  </article>
</section>

<style>
  .wrap {
    padding-top: 3.5rem;
  }
  .card {
    max-width: 44rem;
    margin-inline: auto;
    padding: 2rem 2.25rem 2.25rem;
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
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .message {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin: 1rem 0 1.5rem;
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--warn);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: 0.65rem;
  }
  .hints {
    list-style: none;
    margin: 1.5rem 0 0;
    padding: 1.25rem 0 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem 1.5rem;
    border-top: 1px solid rgb(196 154 78 / 0.28);
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .hints strong {
    color: var(--text);
  }
  @media (max-width: 34rem) {
    .hints {
      grid-template-columns: 1fr;
    }
  }
</style>
