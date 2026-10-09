<script lang="ts">
  // A lifecycle as stations on a gold line: each step with its name and what happens there.
  type Step = { name: string; text: string; tone?: "ok" | "end" | "stop" };
  let { steps }: { steps: readonly Step[] } = $props();
</script>

<ol class="flow" style:--count={steps.length}>
  {#each steps as step, i (step.name)}
    <li class={step.tone ?? ""}>
      <span class="dot">{i + 1}</span>
      <strong>{step.name}</strong>
      <span class="text">{step.text}</span>
    </li>
  {/each}
</ol>

<style>
  .flow {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 0.6rem;
    position: relative;
  }
  .flow::before {
    content: "";
    position: absolute;
    top: 1rem;
    left: 6%;
    right: 6%;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgb(196 154 78 / 0.7) 8%, rgb(196 154 78 / 0.7) 92%, transparent);
  }
  li {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    text-align: center;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid var(--brand-gold);
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--surface);
  }
  .ok .dot {
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border-color: rgb(143 214 173 / 0.6);
  }
  .stop .dot {
    color: var(--fail);
    border-color: rgb(255 194 187 / 0.6);
  }
  strong {
    font-size: var(--fs-sm);
    font-weight: 800;
  }
  .text {
    font-size: var(--fs-xs);
    line-height: 1.55;
    color: var(--text-soft);
  }
  @media (max-width: 52rem) {
    .flow {
      grid-template-columns: 1fr;
    }
    .flow::before {
      top: 0;
      bottom: 0;
      left: 1rem;
      right: auto;
      width: 2px;
      height: auto;
      background: rgb(196 154 78 / 0.5);
    }
    li {
      grid-template-columns: 2rem 1fr;
      justify-items: start;
      text-align: left;
      column-gap: 0.8rem;
    }
    li .text {
      grid-column: 2;
    }
  }
</style>
