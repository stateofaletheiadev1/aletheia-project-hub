<script lang="ts">
  import type { Snippet } from "svelte";
  import Star from "./Star.svelte";
  import SearchBox from "./SearchBox.svelte";

  let { eyebrow, title, lede, aside }: { eyebrow: string; title: string; lede?: string; aside?: Snippet } = $props();
</script>

<section class="head container">
  <div>
    <p class="eyebrow"><Star size={11} hole="var(--bg)" /> {eyebrow}</p>
    <h1>{title}</h1>
    {#if lede}<p class="lede">{lede}</p>{/if}
  </div>
  {#if aside}{@render aside()}{:else}<SearchBox />{/if}
</section>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 2.75rem;
    padding-bottom: 2rem;
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
    overflow-wrap: anywhere;
  }
  .lede {
    margin-top: 0.55rem;
    color: var(--text-soft);
  }
  @media (max-width: 48rem) {
    .head {
      flex-direction: column;
      align-items: stretch;
    }
    h1 {
      font-size: var(--fs-xl);
    }
  }
</style>
