<script lang="ts">
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";

  const types = [
    ["Credit transfer", "The debtor pays the creditor through both their banks; single or in a batch."],
    ["Request to pay", "The payee asks; the payer accepts once, before it expires, and it settles as a credit transfer."],
    ["Mandate and direct debit", "The debtor signs a mandate with a maximum, a frequency and a window; the creditor collects within it."],
    ["Scheduled payment", "The debtor books a payment for a future day; the chain executes it that day, with every check."],
    ["Return", "The creditor sends back all or part of a payment it received."],
    ["Recall request", "The debtor asks for a payment back; the creditor accepts or declines. Finality itself is never undone."],
  ];
</script>

<svelte:head>
  <title>Payment Network · Aletheia Explorer</title>
  <meta name="description" content="The Aletheia Payment Network: how bank payments settle in AEY on AletheiaChain, who may send what, limits, de-duplication and external legs." />
</svelte:head>

<TopicHero
  eyebrow="Assets & Payments"
  title="Payment Network"
  lede="The Aletheia Payment Network lets banks and payment institutions settle their customers' payments in AEY directly on AletheiaChain. A payment is final when its block is final, about a second after it is sent: no clearing house, no settlement cycle, no end-of-day batch."
  keys={[
    { icon: "swap", label: "Settles in", value: "AEY, final in about a second" },
    { icon: "shield", label: "Participants", value: "Admitted by governance" },
    { icon: "layers", label: "Messages", value: "ISO 20022 semantics" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="How a payment settles" wide>
    <Flow
      steps={[
        { name: "Instructed", text: "The customer's bank (the debtor agent) sends the payment from the customer's account." },
        { name: "Routed", text: "The chain checks that each bank is active and serves its customer's account." },
        { name: "Within limits", text: "Per-payment and daily limits of both banks, and the bank's certification for the scheme." },
        { name: "Unique", text: "The payment reference (UETR) has not been settled before by that bank." },
        { name: "Settled", text: "The AEY moves from debtor to creditor in one finalized block.", tone: "ok" },
      ]}
    />
  </Topic>

  <Topic n={2} title="What can be sent" wide>
    <div class="table-wrap">
      <table class="scan">
        <thead><tr><th>Payment type</th><th>How it works</th></tr></thead>
        <tbody>
          {#each types as [name, how] (name)}
            <tr><td><strong>{name}</strong></td><td class="wrap">{how}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Topic>

  <Topic n={3} title="Participants">
    <Facts
      columns={1}
      items={[
        ["Admission", "Banks and payment institutions are admitted, changed, suspended or terminated only by governance. A suspension takes effect at once; other changes after one epoch."],
        ["Settlement account", "Each participant has one settlement account. An indirect participant acts through a sponsor, and only while the sponsor is active."],
        ["Account numbers", "A participant serves its settlement account and the accounts it assigns Aletheian account numbers to, within its own routing range."],
      ]}
    />
  </Topic>

  <Topic n={4} title="Protection built in">
    <Facts
      columns={1}
      items={[
        ["Limits", "Each bank has a per-payment maximum and daily outgoing and incoming maximums, counted per UTC day."],
        ["No double payment", "Every settled payment is remembered by its bank and reference for 400 days; a second payment with the same reference is refused."],
        ["Returns and recalls", "Money can come back only through a return or an accepted recall, as a new payment. A final payment is never reversed."],
      ]}
    />
  </Topic>

  <Topic n={5} title="Payments to and from other systems" wide>
    <p>
      When one side of a payment is outside Aletheia, for example a SEPA Instant transfer to a European bank, the AEY is locked in
      an escrow on AletheiaChain while a licensed gateway completes the external leg. The escrow then either <strong>settles</strong>
      (the external payment succeeded) or is <strong>released</strong> back to the payer (it did not). It can never do both, and it
      never resolves by time alone. The chain checks after every block that the escrowed AEY matches the escrow account exactly.
    </p>
    <Flow
      steps={[
        { name: "Locked", text: "The payer's AEY is placed in escrow for the external leg." },
        { name: "External leg", text: "The gateway sends the payment on the external rail." },
        { name: "Settled", text: "Confirmed: the escrowed AEY completes the payment.", tone: "ok" },
        { name: "Or released", text: "Failed: the AEY returns to the payer in full.", tone: "stop" },
      ]}
    />
  </Topic>

  <Topic n={6} title="Privacy" wide>
    <p>
      The ledger records accounts, amounts, the banks involved and a hash of the payment reference. Names, addresses and other
      personal data stay with the banks and never go on chain. Because only a hash of the reference is recorded, the reference itself
      cannot be read from the ledger.
    </p>
  </Topic>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  .table-wrap .scan {
    min-width: 36rem;
  }
  .wrap {
    white-space: normal !important;
    color: var(--text-soft);
  }
  @media (max-width: 64rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
