<script lang="ts">
  import CopyButton from "./CopyButton.svelte";

  // A code sample in the mono face, with its label and a copy button. The copied text is
  // exactly the code shown.
  let { code, label = "", lang = "" }: { code: string; label?: string; lang?: string } = $props();
</script>

<figure class="code">
  <figcaption>
    <span class="label-text">{label}</span>
    {#if lang}<span class="lang">{lang}</span>{/if}
    <CopyButton value={code} label="Copy code" />
  </figcaption>
  <pre><code>{code}</code></pre>
</figure>

<style>
  .code {
    margin: 0;
    overflow: hidden;
    background: var(--brand-navy-deep);
    border: 1px solid rgb(196 154 78 / 0.35);
    border-radius: var(--radius);
  }
  figcaption {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem 0.4rem 0.9rem;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border-bottom: 1px solid rgb(196 154 78 / 0.3);
  }
  .label-text {
    flex: 1;
  }
  .lang {
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  pre {
    margin: 0;
    padding: 0.9rem 1rem;
    overflow-x: auto;
    font-family: var(--mono);
    font-size: 0.78rem;
    line-height: 1.6;
    color: var(--brand-cream);
  }
</style>
