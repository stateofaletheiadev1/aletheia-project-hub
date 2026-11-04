<script lang="ts">
  // Network (wallet prompt 8): the large seal with its heartbeat (M-10) and the live identity and
  // health of the node the wallet uses.
  import NetworkSeal from "$lib/components/data/NetworkSeal.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import Timestamp from "$lib/components/data/Timestamp.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import { config, explorer } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import { groupWhole } from "$lib/formatting/amount";
  import { network } from "$lib/state/network.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { streamStatus } from "$lib/state/stream.svelte";

  const HEALTH = {
    connecting: { tone: "pending", text: "Connecting to the node…" },
    live: { tone: "verified", text: "Live. New blocks are being finalized." },
    stalled: { tone: "pending", text: "No new finalized block for a few seconds. The network may be slow." },
    unreachable: { tone: "rejected", text: "The node cannot be reached from this browser." },
    "wrong-network": { tone: "rejected", text: "The node reports a different network than expected." },
  } as const;
  const health = $derived(HEALTH[network.health]);
</script>

<div class="network-page">
  <header class="settle">
    <p class="eyebrow">Live status</p>
    <h1>{networkLabel(config.network)}</h1>
    <p class="lede">AletheiaChain as this wallet sees it, read from the node once a second.</p>
  </header>

  <div class="columns">
    <div class="seal settle" style:--settle-order="1"><NetworkSeal size={320} /></div>
    <section class="facts settle" style:--settle-order="2" aria-label="Network facts">
      <InlineStatus tone={health.tone} title={health.text} />
      <dl>
        <div>
          <dt class="eyebrow">Chain ID</dt>
          <dd class="numerals">{network.status?.chainId ?? config.chainId}</dd>
        </div>
        <div>
          <dt class="eyebrow">Network kind</dt>
          <dd>{network.status?.network ?? "—"}</dd>
        </div>
        <div>
          <dt class="eyebrow">Protocol</dt>
          <dd class="numerals">{network.status?.protocolVersion ?? "—"}</dd>
        </div>
        <div>
          <dt class="eyebrow">Finalized height</dt>
          <dd class="numerals">
            {network.status ? groupWhole(network.status.finalizedHeight, prefs.locale) : "—"}{#if network.heightAt}
              · <Timestamp ms={network.heightAt} mode="relative" />{/if}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Latest block</dt>
          <dd>
            {#if network.status}<Identifier
                value={network.status.finalizedBlock}
                label="Latest finalized block"
                truncate
              />{:else}—{/if}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Genesis</dt>
          <dd>
            {#if network.verified}<Identifier value={network.verified.genesisBlock} label="Genesis block" truncate />
              <span class="ok micro">matches</span>{:else}—{/if}
          </dd>
        </div>
        <div>
          <dt class="eyebrow">Syncing</dt>
          <dd>{network.status ? (network.status.syncing ? "Yes" : "No") : "—"}</dd>
        </div>
        <div>
          <dt class="eyebrow">Round trip</dt>
          <dd class="numerals">{network.latencyMs !== null ? `${network.latencyMs} ms` : "—"}</dd>
        </div>
        <div>
          <dt class="eyebrow">Node</dt>
          <dd class="numerals">{new URL(config.rpcUrl).host}</dd>
        </div>
        <div>
          <dt class="eyebrow">Updates</dt>
          <dd>
            {streamStatus.state === "open"
              ? "Finalized blocks pushed over WebSocket"
              : streamStatus.state === "connecting"
                ? "Connecting to the event stream…"
                : "Polled every second"}
          </dd>
        </div>
      </dl>
      <a class="explorer" href={explorer.home()} target="_blank" rel="noopener noreferrer"
        >Blocks and transactions on the Explorer ↗</a
      >
    </section>
  </div>
</div>

<style>
  .network-page {
    display: grid;
    gap: var(--space-12);
    padding: var(--space-12) 0 var(--space-20);
  }

  header {
    display: grid;
    gap: var(--space-3);
  }

  h1 {
    font-size: clamp(2.5rem, 1.8rem + 2.4vw, 4rem);
    font-weight: 300;
    letter-spacing: -0.03em;
  }

  .columns {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-16);
    align-items: start;
  }

  .facts {
    display: grid;
    gap: var(--space-6);
  }

  dl > div {
    display: grid;
    grid-template-columns: 16ch minmax(0, 1fr);
    gap: var(--space-4);
    align-items: baseline;
    min-height: 48px;
    padding: var(--space-2) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  dd {
    margin: 0;
    font-size: var(--type-data);
    font-weight: 500;
    min-width: 0;
  }

  .ok {
    color: var(--state-verified);
    font-weight: 650;
  }

  .explorer {
    font-weight: 650;
    color: var(--ink-heading);
  }

  @media (max-width: 960px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .seal :global(.seal) {
      --size: 240px !important;
    }
  }
</style>
