<script lang="ts">
  import type { IconName } from "./Icon.svelte";
  import Icon from "./Icon.svelte";

  // The opening of an explanatory page: eyebrow, title, lede, and three key facts.
  let {
    eyebrow,
    title,
    lede,
    keys,
  }: { eyebrow: string; title: string; lede: string; keys: readonly { icon: IconName; label: string; value: string }[] } = $props();
</script>

<section class="hero container">
  <div class="words">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
  </div>
  <div class="keys">
    {#each keys as key (key.label)}
      <div class="key">
        <span class="plate"><Icon name={key.icon} size={18} /></span>
        <div>
          <span class="label">{key.label}</span>
          <strong>{key.value}</strong>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 2rem;
    align-items: end;
    padding-top: 2.75rem;
    padding-bottom: 2rem;
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
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.035em;
  }
  .lede {
    margin-top: 0.7rem;
    font-size: var(--fs-md);
    line-height: 1.65;
    color: var(--text-soft);
  }
  .keys {
    display: grid;
    gap: 0.6rem;
  }
  .key {
    display: flex;
    gap: 0.85rem;
    align-items: center;
    padding: 0.8rem 1rem;
    background: rgb(255 255 255 / 0.05);
    border: 1px solid rgb(196 154 78 / 0.3);
    border-radius: var(--radius);
  }
  .plate {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    flex: none;
    border-radius: 0.6rem;
    color: var(--brand-gold-bright);
    background: linear-gradient(160deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.6);
  }
  .key div {
    display: grid;
    gap: 0.1rem;
  }
  .key strong {
    font-size: var(--fs-base);
    font-weight: 800;
  }
  @media (max-width: 60rem) {
    .hero {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }
</style>
