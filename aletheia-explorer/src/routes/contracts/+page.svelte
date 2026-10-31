<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";
  import { ESCROW_ARNO } from "$lib/docs/escrow";
</script>

<svelte:head>
  <title>Arno Contracts · Aletheia Explorer</title>
  <meta name="description" content="Arno, the contract language of AletheiaChain: readable code, money that cannot be copied or lost, declared effects and metered execution." />
</svelte:head>

<TopicHero
  eyebrow="Assets & Payments"
  title="Arno Contracts"
  lede="Arno is AletheiaChain's own contract language, written to read like plain English with the shape of Java. It is built for public money: coins in an Arno contract can be moved but never copied or silently lost, and every contract states up front what it is allowed to do."
  keys={[
    { icon: "shield", label: "Money safety", value: "Coins move; they never duplicate" },
    { icon: "layers", label: "Effects", value: "Declared on every function" },
    { icon: "activity", label: "Execution", value: "Metered in execution units" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="Why a new language">
    <Facts
      columns={1}
      items={[
        ["Coins are things, not numbers", "A value of type Coins must be used exactly once: deposited, transferred or returned. Forgetting coins, or spending them twice, is a compile error, not a runtime surprise."],
        ["Effects are stated", "Each function declares what it does: changes storage, receives coins, sends coins, emits events. The compiler refuses code that does more than it declares."],
        ["Readable rules", "Checks read as sentences: require state is Funded otherwise WrongPhase. Errors carry the message a user will see."],
      ]}
    />
  </Topic>

  <Topic n={2} title="From source to chain">
    <Flow
      steps={[
        { name: "Written", text: "The contract is written in Arno." },
        { name: "Compiled", text: "The compiler checks types, coins and effects, then emits bytecode." },
        { name: "Verified", text: "The chain verifies the bytecode again before accepting it." },
        { name: "Deployed", text: "A deploy transaction installs it at its own address.", tone: "ok" },
      ]}
    />
    <p>
      A contract runs only when a transaction calls one of its public functions. It runs in a sandbox, metered in execution
      units: when the units run out, it stops at exactly that point and everything it did is undone, except the fee.
    </p>
  </Topic>

  <Topic n={3} title="An example: escrow" wide>
    <p>
      This contract holds AEY for a buyer until an arbiter releases it to the seller, or refunds the buyer after a deadline. It is one
      of the reference contracts the Arno compiler is tested against. Note how the deposit is <strong>moved</strong> into the vault and
      can never be touched again, and how each function lists its effects.
    </p>
    <CodeBlock label="escrow.arno" lang="arno" code={ESCROW_ARNO} />
  </Topic>

  <Topic n={4} title="On the ledger" wide>
    <Facts
      columns={2}
      items={[
        ["Deploy", "A contract-deploy transaction carries the verified package and may attach coins; the contract receives its own address."],
        ["Call", "A contract-call transaction names the contract, the function and its arguments, and may attach coins."],
        ["Events", "Contracts emit typed events that appear in the receipt of the calling transaction, under the Logs tab."],
        ["Views", "Functions marked view only read the contract's storage; they can never change it, move coins or emit events."],
      ]}
    />
  </Topic>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 64rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
