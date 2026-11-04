<script lang="ts">
  // Settings (wallet prompt 8): appearance, number display, network information (read-only),
  // version and build.
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import Denomination from "$lib/components/data/Denomination.svelte";
  import { config, explorer } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import { network } from "$lib/state/network.svelte";
  import { prefs } from "$lib/state/prefs.svelte";

  const LOCALES = [
    { value: "en", label: "English" },
    { value: "de", label: "Deutsch" },
    { value: "nl", label: "Nederlands" },
    { value: "it", label: "Italiano" },
    { value: "sr-Latn", label: "Srpski" },
  ];
</script>

<svelte:head><title>Settings · Aletheia Wallet</title></svelte:head>

<div class="settings">
  <header class="settle">
    <p class="eyebrow">Preferences on this device</p>
    <h1>Settings</h1>
  </header>

  <section>
    <h2>Appearance</h2>
    <div class="rows">
      <SegmentedControl
        label="Theme"
        bind:value={prefs.theme}
        options={[
          { value: "system", label: "Follow system" },
          { value: "light", label: "Parchment" },
          { value: "dark", label: "Night Ink" },
        ]}
      />
      <SegmentedControl
        label="Motion"
        bind:value={prefs.motion}
        options={[
          { value: "system", label: "Follow system" },
          { value: "full", label: "Full" },
          { value: "reduce", label: "Reduced" },
        ]}
      />
    </div>
  </section>

  <section>
    <h2>Numbers</h2>
    <div class="rows">
      <SegmentedControl
        label="Amount precision"
        bind:value={prefs.precision}
        options={[
          { value: "significant", label: "Significant" },
          { value: "full", label: "All decimals" },
        ]}
      />
      <p class="example micro">
        Example: <Denomination units={1_250_000_000_000_000_000n} decimals={18} code="AEY" /> — trailing zeros only are hidden;
        no digit is ever rounded.
      </p>
      <label class="select">
        <span class="eyebrow">Number and date format</span>
        <select bind:value={prefs.locale}>
          {#each LOCALES as locale (locale.value)}<option value={locale.value}>{locale.label}</option>{/each}
        </select>
        <span class="micro">Wording stays in English until reviewed translations are published.</span>
      </label>
    </div>
  </section>

  <section>
    <h2>Network</h2>
    <dl>
      <div>
        <dt class="eyebrow">Network</dt>
        <dd>{networkLabel(config.network)}</dd>
      </div>
      <div>
        <dt class="eyebrow">Chain ID</dt>
        <dd class="numerals">{config.chainId}</dd>
      </div>
      <div>
        <dt class="eyebrow">Genesis block</dt>
        <dd>
          {#if network.verified}<Identifier
              value={network.verified.genesisBlock}
              label="Genesis block"
              truncate
            />{:else}—{/if}
        </dd>
      </div>
      <div>
        <dt class="eyebrow">Protocol</dt>
        <dd class="numerals">{network.verified?.protocolVersion ?? "—"}</dd>
      </div>
      <div>
        <dt class="eyebrow">Node</dt>
        <dd class="numerals">{new URL(config.rpcUrl).host}</dd>
      </div>
      <div>
        <dt class="eyebrow">Explorer</dt>
        <dd>
          <a href={explorer.home()} target="_blank" rel="noopener noreferrer">{new URL(config.explorerUrl).host} ↗</a>
        </dd>
      </div>
    </dl>
  </section>

  <section>
    <h2>About this build</h2>
    <dl>
      <div>
        <dt class="eyebrow">Version</dt>
        <dd class="numerals">0.1.0</dd>
      </div>
      <div>
        <dt class="eyebrow">Build</dt>
        <dd class="numerals">{config.buildHash}</dd>
      </div>
      <div>
        <dt class="eyebrow">Key path</dt>
        <dd class="numerals">m/44'/7771'/0'/0'/i' · SLIP-0010 Ed25519</dd>
      </div>
    </dl>
  </section>
</div>

<style>
  .settings {
    display: grid;
    gap: var(--space-10);
    max-width: 860px;
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  section {
    display: grid;
    grid-template-columns: 16ch minmax(0, 1fr);
    gap: var(--space-8);
    padding-top: var(--space-6);
    border-top: var(--hairline) solid var(--rule-strong);
  }

  h2 {
    font-size: 1rem;
    font-weight: 650;
  }

  .rows {
    display: grid;
    gap: var(--space-6);
  }

  .example {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
  }

  .select {
    display: grid;
    gap: var(--space-2);
    max-width: 320px;
  }

  select {
    min-height: var(--field-height);
    padding: 0 var(--space-3);
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--radius-2);
    background: var(--surface-sheet);
    font-weight: 600;
  }

  dl > div {
    display: grid;
    grid-template-columns: 14ch minmax(0, 1fr);
    gap: var(--space-4);
    min-height: 48px;
    align-items: baseline;
    padding: var(--space-2) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  dd {
    margin: 0;
    font-size: var(--type-data);
    font-weight: 500;
    min-width: 0;
  }

  @media (max-width: 720px) {
    section {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
    }
  }
</style>
