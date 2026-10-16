<script lang="ts">
  import { page } from "$app/state";
  import SearchBox from "$lib/components/SearchBox.svelte";
  import { useLive } from "$lib/context";
  import { grouped } from "$lib/format/display";

  const live = useLive();
  const status = $derived(page.status);
  const title = $derived(
    status === 404 ? (page.error?.message ?? "Not found") : status === 503 ? "The node is not answering" : (page.error?.message ?? "Something went wrong"),
  );
</script>

<svelte:head><title>{title} · Aletheia Explorer</title></svelte:head>

<section class="container wrap">
  <article class="panel card">
    <p class="code num">{status}</p>
    <p class="eyebrow">{status === 404 ? "Not in the ledger" : "Unavailable"}</p>
    <h1>{title}</h1>
    {#if page.error?.hint}<p class="hint">{page.error.hint}</p>{/if}
    {#if live?.stats}
      <p class="where num">The chain is at block <a href="/blocks/{live.stats.height}">{grouped(live.stats.height)}</a>.</p>
    {/if}
    <SearchBox />
  </article>
</section>

<style>
  .wrap {
    padding-top: 3.5rem;
  }
  .card {
    position: relative;
    overflow: hidden;
    max-width: 44rem;
    margin-inline: auto;
    padding: 2.25rem 2.25rem 2.5rem;
  }
  .code {
    position: absolute;
    top: -1.5rem;
    right: 1rem;
    font-size: 8rem;
    font-weight: 800;
    letter-spacing: -0.06em;
    color: rgb(196 154 78 / 0.12);
    pointer-events: none;
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
    position: relative;
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .hint {
    position: relative;
    margin-top: 0.6rem;
    font-size: var(--fs-sm);
    color: var(--text-soft);
    overflow-wrap: anywhere;
  }
  .where {
    margin: 1rem 0 1.4rem;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  .where a {
    font-weight: 800;
    color: var(--brand-gold-bright);
  }
</style>
