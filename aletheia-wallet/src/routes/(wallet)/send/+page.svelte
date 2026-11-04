<script lang="ts">
  // Send (wallet prompt 8, 13): composer on the left, the live instrument on the right.
  // Pipeline: draft → price (two simulations, ADR-0006) → review decoded from the exact bytes →
  // hold to sign → re-sign and check the bytes are identical → submit → track (S-5).
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import AddressField from "$lib/components/inputs/AddressField.svelte";
  import AmountField from "$lib/components/inputs/AmountField.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import HoldButton from "$lib/components/inputs/HoldButton.svelte";
  import Instrument, { type InstrumentFields } from "$lib/components/data/Instrument.svelte";
  import StatusStation from "$lib/components/data/StatusStation.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import ErrorSheet from "$lib/components/feedback/ErrorSheet.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { config, explorer } from "$lib/config";
  import { ASSETS, type AssetCode } from "$lib/stablechain/assets/assets";
  import { addressBytes, addressProblem, parseAddress } from "$lib/stablechain/addresses/identifiers";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import { signingBlock } from "$lib/stablechain/network/gate";
  import {
    decodeBody,
    decodeSigned,
    encodeBody,
    encodePreview,
    txIdOf,
    type TransferBody,
  } from "$lib/stablechain/transactions/body";
  import {
    buildTransfer,
    finalTerms,
    priceFrom,
    pricingTerms,
    PricingError,
  } from "$lib/stablechain/transactions/build";
  import {
    stationOf,
    transition,
    type TransferState,
    type TransferEvent,
    type FailureReason,
  } from "$lib/stablechain/transactions/machine";
  import { ChainError, describeChainError, describeProtocolName } from "$lib/stablechain/rpc/errors";
  import { fromHex, toHex } from "$lib/stablechain/encoding/hex";
  import { AmountError, parseAmount } from "$lib/formatting/amount";
  import { parsePaymentUri, UriError } from "$lib/stablechain/uri/payment-uri";
  import { chain } from "$lib/state/chain";
  import { network } from "$lib/state/network.svelte";
  import { ledger } from "$lib/state/ledger.svelte";
  import { session } from "$lib/state/session.svelte";
  import { contacts } from "$lib/state/contacts.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { WalletWorkerError } from "$lib/wallet/worker/client";

  const REPRICE_AFTER_MS = 60_000;
  const encoder = new TextEncoder();

  let recipient = $state("");
  let asset = $state<AssetCode>("ALnT");
  let amountText = $state("");
  let memo = $state("");
  let feeAsset = $state<AssetCode>(prefs.feeAsset);
  let touched = $state(false);
  let uriNote = $state<string | null>(null);

  let tx = $state<TransferState>({ status: "draft" });
  let review = $state<{
    body: TransferBody;
    signedHex: string | null;
    txId: string;
    fee: bigint;
    euUsed: number;
  } | null>(null);
  let stamp = $state<string | null>(null);
  let submittedAt = $state<number | null>(null);
  let now = $state(Date.now());

  function send(event: TransferEvent) {
    tx = transition(tx, event);
  }

  onMount(() => {
    void contacts.load();
    const to = page.url.searchParams.get("to");
    if (to) recipient = to;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const me = $derived(session.active);
  const verified = $derived(network.verified);
  const block = $derived(verified ? signingBlock(verified, config.mainnetSigning, now) : null);
  const mainnetClosed = $derived(config.network === "mainnet" && !config.mainnetSigning);
  const holding = $derived(ledger.snapshot);
  const available = $derived(holding ? holding[asset].available : null);
  const feeAvailable = $derived(holding ? holding[feeAsset].available : null);
  const recipientOk = $derived(recipient.trim() !== "" && addressProblem(recipient.trim(), config.network) === null);
  const units = $derived.by(() => {
    try {
      return parseAmount(amountText, ASSETS[asset].decimals);
    } catch (error) {
      if (error instanceof AmountError) return null;
      throw error;
    }
  });
  const memoBytes = $derived(encoder.encode(memo).length);
  const memoError = $derived(memoBytes > 256 ? `The memo is ${memoBytes} bytes; at most 256.` : null);
  const transferable = $derived(verified ? verified.assets[asset].transferable : true);
  const over = $derived.by(() => {
    if (units === null || available === null) return false;
    const fee = review?.fee ?? 0n;
    return asset === feeAsset ? units + fee > available : units > available;
  });
  const selfSend = $derived(recipientOk && me !== null && recipient.trim() === me.address);
  const draftReady = $derived(
    recipientOk &&
      units !== null &&
      units > 0n &&
      !over &&
      !memoError &&
      transferable &&
      !mainnetClosed &&
      tx.status === "draft",
  );
  const reviewing = $derived(tx.status === "awaitingApproval" || tx.status === "signing");
  const stale = $derived(tx.status === "awaitingApproval" && now - tx.simulatedAt > REPRICE_AFTER_MS);

  // Editing the draft after pricing discards the priced transaction.
  $effect(() => {
    void [recipient, asset, amountText, memo, feeAsset];
    untrack(() => {
      if (tx.status === "awaitingApproval" || tx.status === "simulationFailed") {
        tx = { status: "draft" };
        review = null;
      }
    });
  });

  $effect(() => {
    prefs.feeAsset = feeAsset;
  });

  function applyUri(text: string) {
    try {
      const request = parsePaymentUri(text, config.network);
      recipient = request.recipient;
      asset = request.asset;
      if (request.amount !== null) amountText = formatForInput(request.amount, ASSETS[request.asset].decimals);
      if (request.memo) memo = request.memo;
      uriNote = "Filled from a payment link. Check every field before pricing.";
    } catch (error) {
      uriNote =
        error instanceof UriError
          ? `That payment link cannot be used: ${error.message}.`
          : "That payment link cannot be used.";
    }
  }

  function formatForInput(value: bigint, decimals: number): string {
    const scale = 10n ** BigInt(decimals);
    const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
    return fraction ? `${value / scale}.${fraction}` : `${value / scale}`;
  }

  function reasonFrom(error: unknown): FailureReason {
    if (error instanceof WalletWorkerError) {
      return {
        title: "Not signed",
        body:
          error.kind === "locked"
            ? "The wallet locked. Unlock it and price the transfer again."
            : "The wallet refused to sign this.",
        technical: error.message,
      };
    }
    if (error instanceof PricingError)
      return {
        title: "Could not price the transfer",
        body: "The network's answer could not be turned into fee terms.",
        technical: error.message,
      };
    return describeChainError(error);
  }

  async function signBody(body: TransferBody) {
    if (!verified || !me) throw new Error("no verified network");
    return session.worker.request({
      op: "sign",
      bodyHex: toHex(encodeBody(body)),
      index: me.index,
      network: { chainId: verified.chainId, kind: verified.kind },
    });
  }

  /** Whether the node prices unsigned previews (node ADR-064); learnt on the first pricing. */
  let previewSupported = $state<boolean | null>(null);

  /**
   * Simulates `body`. With a current node this sends an unsigned preview, so nothing is signed
   * before approval. An older node refuses it (TX_THRESHOLD_NOT_MET); then the wallet prices from
   * a signed copy, as before, and says so (PROTOCOL D-3).
   */
  async function simulateBody(body: TransferBody) {
    const bytes = encodeBody(body);
    if (previewSupported !== false && me?.publicKey) {
      try {
        const result = await chain.simulate(encodePreview(bytes, fromHex(me.publicKey)));
        previewSupported = true;
        return { result, signedHex: null };
      } catch (error) {
        const older =
          error instanceof ChainError && error.info.kind === "NodeError" && error.info.name === "TX_THRESHOLD_NOT_MET";
        if (!older) throw error;
        previewSupported = false;
      }
    }
    const signed = await signBody(body);
    return { result: await chain.simulate(fromHex(signed.signedHex)), signedHex: signed.signedHex };
  }

  function failOnChain(receipt: { status: string; errorCode: number; errorName: string }) {
    if (receipt.status !== "SUCCESS") {
      throw new ChainError({
        kind: "NodeError",
        code: receipt.errorCode,
        name: receipt.errorName,
        detail: "the transfer would fail on chain",
      });
    }
  }

  async function price() {
    touched = true;
    if (!draftReady || !me || units === null || feeAvailable === null) return;
    send({ type: "simulate" });
    review = null;
    try {
      const fresh = await network.verify();
      if (!fresh) throw new ChainError({ kind: "WrongNetwork", detail: "the network could not be verified" });
      const blocked = signingBlock(fresh, config.mainnetSigning);
      if (blocked) throw new ChainError({ kind: "WrongNetwork", detail: `signing blocked: ${blocked.reason}` });
      const [account, head] = await Promise.all([chain.account(me.address), chain.finalizedHead()]);
      const draft = {
        sender: addressBytes(parseAddress(me.address, config.network), config.network),
        recipient: addressBytes(parseAddress(recipient.trim(), config.network), config.network),
        asset: ASSETS[asset].id,
        amount: units,
        memo: encoder.encode(memo),
        feeAsset: ASSETS[feeAsset].id,
      };
      const facts = { nonce: BigInt(account.nonce), slot: BigInt(head.slot) };
      const first = (await simulateBody(buildTransfer(draft, fresh, facts, pricingTerms(feeAvailable)))).result;
      failOnChain(first.receipt);
      const unitPrice = priceFrom(BigInt(first.euUsed), BigInt(first.fee.amount));
      const body = buildTransfer(draft, fresh, facts, finalTerms(BigInt(first.euUsed), unitPrice));
      const final = await simulateBody(body);
      failOnChain(final.result.receipt);
      // What the review shows is decoded from the exact bytes that will be signed, not the form.
      const bytes = encodeBody(body);
      review = {
        body: decodeBody(bytes),
        signedHex: final.signedHex,
        txId: txIdOf(bytes, fresh),
        fee: BigInt(final.result.fee.amount),
        euUsed: final.result.euUsed,
      };
      send({ type: "simulated", at: Date.now() });
    } catch (error) {
      const base = reasonFrom(error);
      const named =
        error instanceof ChainError && error.info.kind === "NodeError" && error.info.name
          ? describeProtocolName(error.info.name)
          : null;
      send({ type: "simulationFailed", reason: { ...base, body: named ?? base.body } });
    }
  }

  let submittedHex = "";

  async function approve() {
    if (!review || tx.status !== "awaitingApproval") return;
    if (stale) {
      tx = { status: "draft" };
      void price();
      return;
    }
    send({ type: "approve" });
    try {
      const fresh = await network.verify();
      if (!fresh || signingBlock(fresh, config.mainnetSigning))
        throw new ChainError({ kind: "WrongNetwork", detail: "the network could not be re-verified at approval" });
      const signed = await signBody(review.body);
      // The signature covers exactly the reviewed bytes; a signed price (older node) must match too.
      const sameBody = toHex(decodeSigned(fromHex(signed.signedHex)).bodyBytes) === toHex(encodeBody(review.body));
      if (!sameBody || (review.signedHex !== null && signed.signedHex !== review.signedHex)) {
        throw new Error("the signed bytes differ from the priced transaction");
      }
      submittedHex = signed.signedHex;
      stamp = `Signed locally · digest ${signed.digest.slice(0, 8)}…${signed.digest.slice(-8)}`;
      send({ type: "signed", txId: signed.txId, digest: signed.digest });
    } catch (error) {
      send({ type: "failed", reason: reasonFrom(error) });
      return;
    }
    try {
      const result = await chain.submit(fromHex(submittedHex));
      if (result.txId !== review.txId)
        throw new ChainError({ kind: "InvalidResponse", detail: "the node named the transaction differently" });
      submittedAt = Date.now();
      send({ type: "submitted", at: submittedAt });
      send({ type: "tracking" });
      await ledger.submitted({
        txId: review.txId,
        network: config.network,
        direction: recipient.trim() === me?.address ? "self" : "out",
        sender: me?.address ?? "",
        recipient: recipient.trim(),
        asset,
        amount: review.body.amount.toString(),
        fee: review.fee.toString(),
        feeAsset,
        memo: memo || null,
        status: "submitted",
        errorName: null,
        height: null,
        expirySlot: Number(review.body.expirySlot),
        seenAt: submittedAt,
        finalizedAt: null,
      });
    } catch (error) {
      if (error instanceof ChainError && error.info.kind === "Rejected")
        send({ type: "rejected", reason: reasonFrom(error) });
      else send({ type: "failed", reason: reasonFrom(error) });
    }
  }

  // Follow the ledger's tracking of this transfer into the state machine.
  const tracked = $derived(
    review && submittedAt ? (ledger.activity.find((r) => r.txId === review!.txId) ?? null) : null,
  );
  $effect(() => {
    if (tx.status !== "confirming" || !tracked) return;
    if (tracked.status === "finalized" || tracked.status === "failed-on-chain") {
      send({
        type: "finalized",
        height: tracked.height ?? 0,
        receipt: tracked.status === "finalized" ? "SUCCESS" : "FAILED_EXECUTION",
        errorName: tracked.errorName ?? "",
      });
    } else if (tracked.status === "expired") {
      send({ type: "expired" });
    } else if (!tx.delayed && submittedAt && now - submittedAt > 12_000) {
      send({ type: "delayed" });
    }
  });

  function reset() {
    tx = { status: "draft" };
    review = null;
    stamp = null;
    submittedAt = null;
    amountText = "";
    memo = "";
    touched = false;
  }

  const fields = $derived<InstrumentFields>({
    from: me?.address ?? "",
    to: review ? recipient.trim() : recipientOk ? recipient.trim() : null,
    asset: review ? asset : asset,
    decimals: ASSETS[asset].decimals,
    amount: review ? review.body.amount : units,
    memo: review ? new TextDecoder().decode(review.body.memo) : memo,
    network: config.network,
    chainId: config.chainId,
    fee: review
      ? {
          charged: review.fee,
          max: review.body.maxFee,
          asset: feeAsset,
          decimals: ASSETS[feeAsset].decimals,
          euUsed: review.euUsed,
          euLimit: review.body.euLimit,
        }
      : null,
    nonce: review ? review.body.nonce : null,
    validFrom: review ? review.body.validFromSlot : null,
    expiry: review ? review.body.expirySlot : null,
    txId: review ? review.txId : null,
  });

  const tone = $derived(
    tx.status === "finalized"
      ? tx.receipt === "SUCCESS"
        ? "finalized"
        : "rejected"
      : tx.status === "rejected" || tx.status === "failed"
        ? "rejected"
        : tx.status === "expired"
          ? "expired"
          : tx.status === "confirming" && tx.delayed
            ? "delayed"
            : "progress",
  );
  const afterSigning = $derived(
    ["signed", "submitted", "confirming", "finalized", "rejected", "expired", "failed"].includes(tx.status) &&
      stamp !== null,
  );
</script>

<svelte:head><title>Send · Aletheia Wallet</title></svelte:head>

<div class="send">
  <header class="settle">
    <p class="eyebrow">Transfer</p>
    <h1>Send</h1>
  </header>

  {#if mainnetClosed}
    <InlineStatus tone="planned" title="Sending opens soon on {networkLabel(config.network)}">
      This wallet can already receive and show balances. Sending is switched on once AletheiaChain's wallet key standard
      is confirmed.
    </InlineStatus>
  {/if}

  <div class="columns">
    <section class="composer settle" style:--settle-order="1" aria-label="Compose">
      <AddressField
        bind:value={recipient}
        contacts={contacts.list}
        self={me?.address ?? null}
        onuri={applyUri}
        {touched}
      />
      {#if uriNote}<p class="micro note">{uriNote}</p>{/if}
      {#if selfSend}<InlineStatus tone="pending" title="Sending to yourself"
          >This is the active account's own address. Only the fee will leave it.</InlineStatus
        >{/if}
      {#if contacts.list.length}
        <div class="quick" aria-label="From the address book">
          {#each contacts.list.filter((c) => contacts.valid(c)).slice(0, 5) as c (c.id)}
            <button type="button" class="contact" onclick={() => (recipient = c.address)}>{c.name}</button>
          {/each}
        </div>
      {/if}

      <SegmentedControl
        label="Asset"
        bind:value={asset}
        options={[
          { value: "ALnT", label: "ALnT · Aletheia Talent" },
          { value: "AEY", label: "AEY · Aletheian Guilder" },
        ]}
      />
      {#if !transferable}<InlineStatus tone="planned" title="{asset} cannot be transferred at present"
          >The network reports this asset as not transferable.</InlineStatus
        >{/if}

      <AmountField
        bind:value={amountText}
        decimals={ASSETS[asset].decimals}
        code={asset}
        max={asset === feeAsset ? null : available}
        {touched}
        {over}
      />
      {#if available !== null}
        <p class="micro">
          Available: <span class="numerals">{formatForInput(available, ASSETS[asset].decimals)}</span>
          {asset}{asset === feeAsset ? " · the fee is paid from this too" : ""}
        </p>
      {/if}

      <TextField
        label="Memo (optional)"
        bind:value={memo}
        error={memoError}
        hint="Visible on the public ledger. {memoBytes}/256 bytes."
        autocomplete="off"
      />

      <SegmentedControl
        label="Pay the fee in"
        bind:value={feeAsset}
        options={[
          { value: "ALnT", label: "ALnT" },
          { value: "AEY", label: "AEY" },
        ]}
      />

      {#if tx.status === "draft" || tx.status === "simulating"}
        <div class="price">
          <Button
            variant="primary"
            icon="seal"
            busy={tx.status === "simulating"}
            disabled={!draftReady && tx.status === "draft"}
            onclick={price}
          >
            {tx.status === "simulating" ? "Pricing with the network…" : "Price this transfer"}
          </Button>
          <p class="micro">
            {#if previewSupported === false}
              This node prices a transfer from a signed copy. It is sent to the node only to be priced; nothing is
              submitted until you sign below.
            {:else}
              The network prices the transfer before you sign anything. Nothing is signed or sent until you hold to
              sign.
            {/if}
          </p>
        </div>
      {/if}
      {#if block?.reason === "syncing"}<InlineStatus tone="pending" title="The node is catching up"
          >Pricing waits until it has synced.</InlineStatus
        >{/if}
    </section>

    <section class="preview" aria-label="Review">
      <div class:unfold={reviewing}>
        <Instrument {fields} decoded={!!review} {stamp}>
          {#snippet footer()}
            {#if tx.status === "simulationFailed"}
              <ErrorSheet title={tx.reason.title} body={tx.reason.body} technical={tx.reason.technical}>
                {#snippet actions()}<Button variant="quiet" onclick={() => (tx = { status: "draft" })}
                    >Edit the transfer</Button
                  >{/snippet}
              </ErrorSheet>
            {:else if reviewing && review}
              {#if stale}
                <InlineStatus tone="pending" title="This price is over a minute old"
                  >Holding will price it again first.</InlineStatus
                >
              {/if}
              <HoldButton
                label="Hold to sign and send"
                duration={1000}
                disabled={tx.status === "signing"}
                onconfirm={approve}
              />
              <Button variant="plain" onclick={() => (tx = { status: "draft" })}>Change something</Button>
            {:else if afterSigning}
              <StatusStation
                station={stationOf(tx)}
                {tone}
                note={tx.status === "confirming" && tx.delayed
                  ? "Network is slower than usual; your transaction is not lost."
                  : tx.status === "finalized" && tx.receipt !== "SUCCESS"
                    ? (describeProtocolName(tx.errorName) ?? "Included but failed on chain. The fee was charged.")
                    : tx.status === "expired"
                      ? "Its validity window closed before inclusion. Nothing moved; you can send it again."
                      : null}
              />
              {#if tx.status === "finalized" && tx.receipt === "SUCCESS"}
                <div class="final">
                  <span class="final-seal" aria-hidden="true"><Icon name="seal" size={28} /></span>
                  <p>Finalized at block <span class="numerals">{tx.height.toLocaleString(prefs.locale)}</span>.</p>
                </div>
              {/if}
              {#if tx.status === "rejected" || tx.status === "failed"}
                <ErrorSheet title={tx.reason.title} body={tx.reason.body} technical={tx.reason.technical} />
              {/if}
              <div class="after">
                {#if review}<Button variant="quiet" href="/transactions/{encodeURIComponent(review.txId)}"
                    >Transaction record</Button
                  >{/if}
                {#if tx.status === "finalized" && review}<Button
                    variant="plain"
                    href={explorer.tx(review.txId)}
                    target="_blank"
                    rel="noopener noreferrer">View on the Explorer ↗</Button
                  >{/if}
                {#if tx.status !== "confirming" && tx.status !== "submitted" && tx.status !== "signed"}<Button
                    variant="plain"
                    onclick={reset}>New transfer</Button
                  >{/if}
              </div>
            {/if}
          {/snippet}
        </Instrument>
      </div>
    </section>
  </div>
</div>

<style>
  .send {
    display: grid;
    gap: var(--space-8);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: var(--space-12);
    align-items: start;
  }

  .composer {
    display: grid;
    gap: var(--space-6);
  }

  .preview {
    position: sticky;
    top: var(--space-8);
  }

  .note {
    margin-top: calc(var(--space-4) * -1);
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: calc(var(--space-3) * -1);
  }

  .contact {
    min-height: 32px;
    padding: 0 var(--space-3);
    border: var(--hairline) solid var(--rule-hairline);
    border-radius: var(--radius-2);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--ink-heading);
  }

  .contact:hover {
    border-color: var(--rule-strong);
  }

  .price {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
    padding-top: var(--space-2);
  }

  .price .micro {
    max-width: 52ch;
  }

  .final {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--state-verified);
    font-weight: 650;
  }

  .final-seal {
    display: grid;
    place-items: center;
    animation: stamp-seal 520ms var(--ease-seal);
  }

  @keyframes stamp-seal {
    from {
      transform: scale(1.6) rotate(-12deg);
      opacity: 0;
    }
  }

  .after {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  @media (max-width: 1100px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview {
      position: static;
    }
  }
</style>
