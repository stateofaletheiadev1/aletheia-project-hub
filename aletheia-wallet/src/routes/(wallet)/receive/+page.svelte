<script lang="ts">
  // Receive (wallet prompt 8): an engraved QR in a guilloché frame, the canonical address grouped,
  // and an optional amount request as an APS-0030 payment link.
  import QrCode from "$lib/components/media/QrCode.svelte";
  import Guilloche from "$lib/components/foundations/Guilloche.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import { config } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import { ASSETS, type AssetCode } from "$lib/stablechain/assets/assets";
  import { AmountError, parseAmount } from "$lib/formatting/amount";
  import { formatPaymentUri } from "$lib/stablechain/uri/payment-uri";
  import { session } from "$lib/state/session.svelte";

  let asset = $state<AssetCode>("ALnT");
  let amountText = $state("");
  let memo = $state("");
  let copied = $state(false);
  let shared = $state<string | null>(null);

  const address = $derived(session.activeAddress);
  const amount = $derived.by(() => {
    if (!amountText.trim()) return { units: null, error: null };
    try {
      return { units: parseAmount(amountText, ASSETS[asset].decimals), error: null };
    } catch (error) {
      return { units: null, error: error instanceof AmountError ? `Amount: ${error.message}.` : "Enter an amount." };
    }
  });
  const memoError = $derived(new TextEncoder().encode(memo).length > 256 ? "At most 256 bytes." : null);
  const uri = $derived(
    address && !amount.error && !memoError
      ? formatPaymentUri({ recipient: address, asset, amount: amount.units, memo: memo || null })
      : null,
  );

  async function copyUri() {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }

  async function share() {
    if (!uri) return;
    if (!navigator.share) {
      shared = "Sharing is not available in this browser. Copy the link instead.";
      return;
    }
    try {
      await navigator.share({ title: "Aletheia payment request", text: uri });
      shared = null;
    } catch {
      shared = null;
    }
  }
</script>

<svelte:head><title>Receive · Aletheia Wallet</title></svelte:head>

<div class="receive">
  <header class="settle">
    <p class="eyebrow">{session.active?.name} · {networkLabel(config.network)}</p>
    <h1>Receive</h1>
  </header>

  {#if address}
    <div class="columns">
      <figure class="frame settle" style:--settle-order="1">
        <Guilloche variant="band" width={400} height={16} seed={11} />
        <div class="qr">
          <QrCode
            value={uri ?? address}
            size={260}
            label="QR code for {uri && uri !== address ? 'the payment request' : 'your address'}"
          />
        </div>
        <Guilloche variant="band" width={400} height={16} seed={13} />
        <figcaption class="micro">
          {amount.units !== null ? "Payment request" : "Address"} · scan with an Aletheia wallet
        </figcaption>
      </figure>

      <section class="details settle" style:--settle-order="2">
        <div class="address">
          <p class="eyebrow">Your address</p>
          <Identifier value={address} label="Your address" size="large" />
          <p class="micro">
            Only send AEY or ALnT on {networkLabel(config.network)} to this address. The letter case is its checksum: share
            it exactly.
          </p>
        </div>

        <div class="request">
          <h2>Request an amount</h2>
          <SegmentedControl
            label="Asset"
            bind:value={asset}
            options={[
              { value: "ALnT", label: "ALnT" },
              { value: "AEY", label: "AEY" },
            ]}
          />
          <TextField
            label="Amount (optional)"
            bind:value={amountText}
            error={amount.error}
            inputmode="decimal"
            placeholder="0"
            autocomplete="off"
          />
          <TextField label="Memo (optional)" bind:value={memo} error={memoError} autocomplete="off" />
          {#if uri}
            <div class="uri">
              <p class="eyebrow">Payment link</p>
              <code class="numerals">{uri}</code>
              <div class="actions">
                <Button variant="quiet" icon={copied ? "check" : "copy"} onclick={copyUri}
                  >{copied ? "Copied" : "Copy link"}</Button
                >
                <Button variant="plain" onclick={share}>Share</Button>
              </div>
              {#if shared}<p class="micro">{shared}</p>{/if}
            </div>
          {/if}
        </div>
      </section>
    </div>
  {:else}
    <InlineStatus tone="info" title="No account">Unlock the wallet to show its address.</InlineStatus>
  {/if}
</div>

<style>
  .receive {
    display: grid;
    gap: var(--space-8);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
  }

  .columns {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-12);
    align-items: start;
  }

  .frame {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    margin: 0;
    padding: var(--space-5);
    width: 320px;
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--sheet-radius);
    background: var(--surface-sheet);
  }

  .qr {
    padding: var(--space-2);
    border: var(--hairline) solid var(--rule-hairline);
    border-radius: var(--radius-2);
    background: var(--qr-paper);
  }

  .details {
    display: grid;
    gap: var(--space-10);
  }

  .address,
  .request {
    display: grid;
    gap: var(--space-4);
  }

  .address {
    padding-bottom: var(--space-8);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .request {
    max-width: 520px;
  }

  .uri {
    display: grid;
    gap: var(--space-2);
  }

  code {
    font-family: var(--font-sans);
    font-size: var(--type-data);
    word-break: break-all;
    color: var(--ink-secondary);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .frame {
      width: 100%;
      max-width: 340px;
    }
  }
</style>
