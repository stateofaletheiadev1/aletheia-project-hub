<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import Star from "$lib/components/Star.svelte";

  let { data } = $props();
</script>

<svelte:head><title>{data.title} · Aletheia Explorer</title></svelte:head>

<section class="container wrap">
  <article class="panel card">
    <div class="watermark" aria-hidden="true"><Star size={260} hole="transparent" /></div>
    <p class="eyebrow"><Star size={11} hole="var(--surface)" /> {data.eyebrow}</p>
    <h1>{data.title}</h1>
    <p class="status">This section is being prepared and is not open yet.</p>

    <h2 class="label">What it will show</h2>
    <ul>
      {#each data.will as line (line)}
        <li><Star size={10} hole="var(--surface)" /> {line}</li>
      {/each}
    </ul>

    <div class="now">
      <p class="label">Open now</p>
      <nav>
        <a href="/blocks"><Icon name="block" size={15} /> Blocks</a>
        <a href="/transactions"><Icon name="swap" size={15} /> Transactions</a>
        <a href="/validators"><Icon name="shield" size={15} /> Validators</a>
        <a href="/treasury"><Icon name="vault" size={15} /> Treasury</a>
      </nav>
    </div>
  </article>
</section>

<style>
  .wrap {
    padding-top: 3rem;
  }
  .card {
    position: relative;
    overflow: hidden;
    max-width: 46rem;
    margin-inline: auto;
    padding: 2.25rem 2.25rem 2rem;
  }
  .watermark {
    position: absolute;
    top: -4rem;
    right: -4rem;
    opacity: 0.06;
    pointer-events: none;
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
  }
  .status {
    display: inline-block;
    margin: 0.75rem 0 1.75rem;
    padding: 0.3rem 0.7rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.4rem;
  }
  h2 {
    margin-bottom: 0.7rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  li {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    font-size: var(--fs-base);
    line-height: 1.55;
    color: var(--text-soft);
  }
  .now {
    margin-top: 2rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgb(196 154 78 / 0.28);
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.7rem;
  }
  nav a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: 0.5rem;
    transition: border-color var(--quick) var(--ease);
  }
  nav a:hover {
    border-color: var(--brand-gold);
    color: var(--brand-gold-bright);
  }
</style>
