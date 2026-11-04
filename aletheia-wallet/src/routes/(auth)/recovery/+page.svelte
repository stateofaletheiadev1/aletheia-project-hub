<script lang="ts">
  // Recovery guidance (wallet prompt 8, 11.5): editorial, plain, with engraved line art.
  import CeremonyShell from "$lib/layouts/CeremonyShell.svelte";
  import IllustrationLine from "$lib/components/feedback/IllustrationLine.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
</script>

<CeremonyShell>
  <article class="guide settle">
    <p class="eyebrow">Recovery</p>
    <h1>The phrase is the wallet</h1>
    <p class="lede">
      Your 24 words recreate every account, on any device. The password only protects the copy sealed in this browser.
      There is no server-side recovery: no one can reset a password or restore a lost phrase.
    </p>

    <section class="step">
      <IllustrationLine scene="certificate" />
      <div>
        <p class="eyebrow">I · Keep it</p>
        <h2>Write it on paper, keep it offline</h2>
        <p>
          Two copies in two safe places. Never a photo, cloud note, email or message. Anyone who reads the words can
          move your funds.
        </p>
      </div>
    </section>
    <section class="step">
      <IllustrationLine scene="vault" />
      <div>
        <p class="eyebrow">II · Forgotten password</p>
        <h2>Restore from the phrase</h2>
        <p>
          Choose “Restore a wallet”, enter the 24 words and set a new password. The same addresses and balances return,
          because they live on AletheiaChain, not here.
        </p>
      </div>
    </section>
    <section class="step">
      <IllustrationLine scene="marker" />
      <div>
        <p class="eyebrow">III · New device</p>
        <h2>The same phrase, anywhere</h2>
        <p>
          Restoring on another browser gives the same accounts. A keystore file from the command-line tool also opens
          here with its own password.
        </p>
      </div>
    </section>
    <div class="actions">
      <Button variant="primary" href="/import">Restore a wallet</Button>
      <Button variant="plain" href="/unlock">Back to unlock</Button>
    </div>
  </article>
</CeremonyShell>

<style>
  .guide {
    display: grid;
    gap: var(--space-8);
    max-width: 760px;
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .step {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: var(--space-8);
    align-items: center;
    padding-top: var(--space-6);
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .step div {
    display: grid;
    gap: var(--space-2);
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
  }

  .step p:not(.eyebrow) {
    color: var(--ink-secondary);
  }

  .actions {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .step {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
