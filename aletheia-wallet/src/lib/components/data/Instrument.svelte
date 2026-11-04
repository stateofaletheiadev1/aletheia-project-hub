<script lang="ts" module>
  import type { NetworkKind } from "$lib/stablechain/network/kind";

  export interface InstrumentFields {
    readonly from: string;
    readonly to: string | null;
    readonly asset: string;
    readonly decimals: number;
    readonly amount: bigint | null;
    readonly memo: string;
    readonly network: NetworkKind;
    readonly chainId: number;
    readonly fee: {
      readonly charged: bigint;
      readonly max: bigint;
      readonly asset: string;
      readonly decimals: number;
      readonly euUsed: number;
      readonly euLimit: bigint;
    } | null;
    readonly nonce: bigint | null;
    readonly validFrom: bigint | null;
    readonly expiry: bigint | null;
    readonly txId: string | null;
  }
</script>

<script lang="ts">
  // S-4 The Signing Document: an "Instruction to Transfer" with ruled fields and a guilloché header.
  // Before pricing it mirrors the draft (marked "Draft"); after pricing every field is decoded from
  // the exact bytes that will be signed (wallet prompt 13.1 step 5).
  import type { Snippet } from "svelte";
  import Guilloche from "$lib/components/foundations/Guilloche.svelte";
  import Denomination from "./Denomination.svelte";
  import Identifier from "./Identifier.svelte";
  import NetworkSeal from "./NetworkSeal.svelte";
  import { groupWhole } from "$lib/formatting/amount";
  import { prefs } from "$lib/state/prefs.svelte";
  import { networkLabel } from "$lib/stablechain/network/kind";

  let {
    fields,
    decoded = false,
    stamp = null,
    footer,
  }: { fields: InstrumentFields; decoded?: boolean; stamp?: string | null; footer?: Snippet } = $props();
</script>

<article class="instrument" class:decoded aria-label="Instruction to transfer">
  <Guilloche variant="band" width={560} height={20} seed={7} />
  <header>
    <div>
      <p class="eyebrow">Sovereign Covenant State of Aletheia · AletheiaChain</p>
      <h2>Instruction to Transfer</h2>
    </div>
    <span class="state eyebrow">{decoded ? "Decoded from the bytes to sign" : "Draft"}</span>
  </header>

  <dl>
    <div>
      <dt class="eyebrow">From</dt>
      <dd><Identifier value={fields.from} label="From" copy={false} /></dd>
    </div>
    <div>
      <dt class="eyebrow">To</dt>
      <dd>
        {#if fields.to}<Identifier value={fields.to} label="To" copy={false} />{:else}<span class="blank">—</span>{/if}
      </dd>
    </div>
    <div class="amount-row">
      <dt class="eyebrow">Amount</dt>
      <dd>
        {#if fields.amount !== null}<Denomination
            units={fields.amount}
            decimals={fields.decimals}
            code={fields.asset}
            size="title"
            precision="full"
          />{:else}<span class="blank">—</span>{/if}
      </dd>
    </div>
    <div>
      <dt class="eyebrow">Memo</dt>
      <dd class="memo">{fields.memo || "None"}</dd>
    </div>
    <div class="network-row">
      <dt class="eyebrow">Network</dt>
      <dd>
        <NetworkSeal size={40} compact live={false} /><span
          >{networkLabel(fields.network)} · chain <span class="numerals">{fields.chainId}</span></span
        >
      </dd>
    </div>
    <div>
      <dt class="eyebrow">Fee</dt>
      <dd>
        {#if fields.fee}
          <span class="fee">
            <Denomination
              units={fields.fee.charged}
              decimals={fields.fee.decimals}
              code={fields.fee.asset}
              precision="full"
            />
            <span class="micro"
              >from simulation · {groupWhole(fields.fee.euUsed, prefs.locale)} execution units · at most <Denomination
                units={fields.fee.max}
                decimals={fields.fee.decimals}
                code={fields.fee.asset}
              /> ({groupWhole(fields.fee.euLimit, prefs.locale)} units)</span
            >
          </span>
        {:else}<span class="blank">Priced by the network before signing</span>{/if}
      </dd>
    </div>
    <div>
      <dt class="eyebrow">Sequence</dt>
      <dd class="numerals">{fields.nonce !== null ? `Nonce ${fields.nonce}` : "—"}</dd>
    </div>
    <div>
      <dt class="eyebrow">Valid</dt>
      <dd class="numerals">
        {fields.validFrom !== null && fields.expiry !== null
          ? `Slots ${groupWhole(fields.validFrom, prefs.locale)} – ${groupWhole(fields.expiry, prefs.locale)} · about ${Math.round(Number(fields.expiry - fields.validFrom) / 120)} minutes`
          : "—"}
      </dd>
    </div>
    {#if fields.txId}<div>
        <dt class="eyebrow">Transaction</dt>
        <dd><Identifier value={fields.txId} label="Transaction id" truncate /></dd>
      </div>{/if}
  </dl>

  {#if stamp}<p class="stamp numerals" role="status">{stamp}</p>{/if}
  {#if footer}<div class="footer">{@render footer()}</div>{/if}
</article>

<style>
  .instrument {
    display: grid;
    gap: var(--space-5);
    padding: var(--space-5) var(--space-6) var(--space-6);
    background: var(--sheet-bg);
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--sheet-radius);
    transform-origin: top center;
  }

  .decoded {
    border-color: var(--rule-strong);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: var(--hairline) solid var(--rule-strong);
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .state {
    color: var(--ink-muted);
    text-align: end;
  }

  .decoded .state {
    color: var(--state-verified);
  }

  dl {
    display: grid;
  }

  dl > div {
    display: grid;
    grid-template-columns: 9.5ch minmax(0, 1fr);
    gap: var(--space-4);
    align-items: baseline;
    min-height: 48px;
    padding: var(--space-3) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  dd {
    margin: 0;
    min-width: 0;
    font-size: var(--type-data);
    font-weight: 500;
  }

  .amount-row {
    align-items: center;
  }

  .network-row dd {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .network-row {
    align-items: center;
  }

  .memo {
    overflow-wrap: anywhere;
  }

  .fee {
    display: grid;
    gap: var(--space-1);
  }

  .blank {
    color: var(--ink-muted);
  }

  .stamp {
    padding: var(--space-3) var(--space-4);
    border: var(--hairline) dashed var(--accent-seal);
    color: var(--accent-seal-ink);
    font-size: var(--type-data);
    font-weight: 650;
    letter-spacing: 0.04em;
    justify-self: start;
    animation: stamp 420ms var(--ease-seal);
  }

  @keyframes stamp {
    from {
      opacity: 0;
      transform: scale(1.08);
    }
  }

  .footer {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-2);
  }

  @media (max-width: 520px) {
    .instrument {
      padding: var(--space-4);
    }

    dl > div {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }
  }
</style>
