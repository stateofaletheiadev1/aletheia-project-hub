<script lang="ts">
  // Landing (S-1 The Entrance): Night Ink; the survey draws itself; the arms rise; the eyebrow
  // tightens from 0.4em to 0.14em; the seal reports the live finalized height (or says it cannot);
  // the actions arrive last. Plays once per session, ≤ 1.8 s, skippable with any key or click.
  import { onMount } from "svelte";
  import Arms from "$lib/components/foundations/Arms.svelte";
  import ContourField from "$lib/components/foundations/ContourField.svelte";
  import NetworkSeal from "$lib/components/data/NetworkSeal.svelte";
  import SiteFooter from "$lib/layouts/SiteFooter.svelte";
  import ThemeToggle from "$lib/layouts/ThemeToggle.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { hasStoredWallet } from "$lib/storage/db";
  import { config, explorer } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";

  let stored = $state<boolean | null>(null);
  let played = $state(false);

  onMount(() => {
    try {
      played = sessionStorage.getItem("aletheia-wallet:entrance") === "seen";
      sessionStorage.setItem("aletheia-wallet:entrance", "seen");
    } catch {
      played = false;
    }
    void hasStoredWallet().then((value) => (stored = value));
    const skip = () => (played = true);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  });
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="landing">
  <section class="entrance night" class:played aria-labelledby="landing-title">
    <ContourField field="landing" plot={!played} />
    <div class="tools"><ThemeToggle /></div>
    <div class="identity" id="main">
      <div class="arms"><Arms size={112} /></div>
      <p class="eyebrow state">Sovereign Covenant State of Aletheia</p>
      <h1 id="landing-title">Aletheia Wallet</h1>
      <p class="descriptor"><em>The Private Ledger</em></p>
      <p class="lede">
        The official non-custodial wallet for AletheiaChain. Native accounts, AEY and ALnT, and transfers you can verify
        — held entirely in your hands.
      </p>
    </div>
    <div class="threshold">
      <div class="seal"><NetworkSeal size={208} /></div>
      <div class="actions" role="group" aria-label="Begin">
        {#if stored}
          <a class="primary" href="/unlock"><Icon name="unlock" size={18} /><span>Unlock your wallet</span></a>
          <a class="secondary" href="/create">Create another wallet</a>
        {:else}
          <a class="primary" href="/create"><Icon name="key" size={18} /><span>Create a wallet</span></a>
          <a class="secondary" href="/import">Restore from a recovery phrase</a>
        {/if}
        <p class="micro network-line">
          {networkLabel(config.network)} · Chain <span class="numerals">{config.chainId}</span>
        </p>
      </div>
    </div>
  </section>

  <section class="principles" aria-label="Principles">
    <article class="settle" style:--settle-order="0">
      <p class="eyebrow">I · Custody</p>
      <h2>This ledger belongs only to you</h2>
      <p>
        Your recovery phrase is made in your browser and sealed there with your password. It is never sent anywhere —
        not to us, not to the network.
      </p>
    </article>
    <article class="settle" style:--settle-order="1">
      <p class="eyebrow">II · Verification</p>
      <h2>Signed here, checked against the chain</h2>
      <p>
        Before every signature the wallet confirms it is speaking to AletheiaChain itself: chain identity, network and
        genesis. Transfers are priced by the network first.
      </p>
    </article>
    <article class="settle" style:--settle-order="2">
      <p class="eyebrow">III · Precision</p>
      <h2>Exact to the last unit</h2>
      <p>
        AEY to eighteen decimal places, ALnT to three. Amounts are never rounded, and a transfer is final only when the
        network says so.
      </p>
    </article>
  </section>

  <section class="ledger-links" aria-label="More">
    <a href="/security"
      ><span class="eyebrow">Read</span><span>How the wallet keeps keys safe</span><Icon name="chevron" size={18} /></a
    >
    <a href="/help"
      ><span class="eyebrow">Guide</span><span>Sending, receiving and recovery</span><Icon
        name="chevron"
        size={18}
      /></a
    >
    <a href={explorer.home()} target="_blank" rel="noopener noreferrer"
      ><span class="eyebrow">Public ledger</span><span>The Aletheia Explorer</span><Icon name="external" size={18} /></a
    >
  </section>

  <SiteFooter />
</div>

<style>
  .landing {
    min-height: 100dvh;
    background: var(--surface-page);
  }

  .entrance {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-12);
    min-height: min(100dvh, 960px);
    padding: var(--space-24) var(--page-margin) var(--space-16);
    background: var(--surface-page);
    color: var(--ink-primary);
    overflow: hidden;
    isolation: isolate;
  }

  .tools {
    position: absolute;
    top: var(--space-6);
    right: var(--page-margin);
    z-index: var(--z-sticky);
  }

  .identity,
  .threshold {
    position: relative;
    z-index: var(--z-content);
  }

  .identity {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  .arms {
    margin-bottom: var(--space-4);
    animation: rise 900ms var(--ease-ink) 200ms both;
  }

  .state {
    color: var(--accent-seal-ink);
    animation: track-in 900ms var(--ease-ink) 350ms both;
  }

  h1 {
    font-size: clamp(3rem, 2rem + 4vw, 5.5rem);
    font-weight: 300;
    letter-spacing: -0.035em;
    line-height: 1;
    color: var(--ink-heading);
    animation: ink-settle 700ms var(--ease-ink) 650ms both;
  }

  .descriptor {
    font-size: clamp(1.25rem, 1rem + 0.8vw, 1.75rem);
    font-weight: 300;
    color: var(--ink-secondary);
    animation: ink-settle 700ms var(--ease-ink) 800ms both;
  }

  .lede {
    margin-top: var(--space-4);
    font-size: 1.125rem;
    line-height: 1.65;
    color: var(--ink-secondary);
    max-width: 46ch;
    animation: ink-settle 700ms var(--ease-ink) 950ms both;
  }

  .threshold {
    display: grid;
    justify-items: center;
    gap: var(--space-10);
  }

  .seal {
    animation: seal-pulse 900ms var(--ease-seal) 700ms both;
  }

  .actions {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    width: min(100%, 340px);
    animation: ink-settle 600ms var(--ease-ink) 1200ms both;
  }

  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 52px;
    border-radius: var(--radius-2);
    text-decoration: none;
    font-weight: 700;
  }

  .primary {
    position: relative;
    background: var(--button-primary-bg);
    color: var(--button-primary-ink);
  }

  .primary::after {
    content: "";
    position: absolute;
    left: var(--space-4);
    right: var(--space-4);
    bottom: 7px;
    height: var(--hairline);
    background: var(--accent-seal);
  }

  .primary:hover {
    background: var(--button-primary-bg-hover);
  }

  .secondary {
    color: var(--ink-heading);
    border: var(--hairline) solid var(--rule-control);
  }

  .secondary:hover {
    border-color: var(--rule-strong);
  }

  .network-line {
    margin-top: var(--space-2);
    letter-spacing: 0.06em;
  }

  .played .arms,
  .played .state,
  .played h1,
  .played .descriptor,
  .played .lede,
  .played .seal,
  .played .actions {
    animation: none;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  @keyframes track-in {
    from {
      opacity: 0;
      letter-spacing: 0.4em;
    }
  }

  @keyframes seal-pulse {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    60% {
      opacity: 1;
      transform: scale(1.015);
    }
  }

  .principles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-12);
    padding: var(--space-20) var(--page-margin) var(--space-16);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .principles article {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    padding-top: var(--space-5);
    border-top: var(--hairline) solid var(--rule-strong);
  }

  .principles h2 {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: var(--type-title-track);
  }

  .principles p:not(.eyebrow) {
    color: var(--ink-secondary);
  }

  .ledger-links {
    display: grid;
    padding: var(--space-8) var(--page-margin) var(--space-16);
  }

  .ledger-links a {
    display: grid;
    grid-template-columns: 14ch 1fr auto;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--row-height);
    border-bottom: var(--hairline) solid var(--rule-hairline);
    text-decoration: none;
    font-weight: 600;
    color: var(--ink-heading);
  }

  .ledger-links a:hover {
    background: var(--ledger-row-hover);
  }

  :global(:root[data-motion="reduce"]) .entrance * {
    animation-duration: 150ms !important;
    animation-delay: 0ms !important;
  }

  @media (max-width: 960px) {
    .entrance {
      grid-template-columns: minmax(0, 1fr);
      padding-top: var(--space-20);
    }

    .threshold {
      justify-items: start;
    }

    .actions {
      justify-items: stretch;
    }

    .principles {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-8);
    }

    .ledger-links a {
      grid-template-columns: 1fr auto;
    }

    .ledger-links .eyebrow {
      grid-column: 1 / -1;
      margin-bottom: -12px;
      padding-top: var(--space-3);
    }
  }
</style>
