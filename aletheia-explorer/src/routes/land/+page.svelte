<script lang="ts">
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";

  const operations = [
    ["Register a parcel", "59", "The land authority records the parcel, its class, its controller and a commitment to its boundaries."],
    ["Transfer", "60", "The current controller transfers it; for classes that require it, the authority co-signs that one transfer."],
    ["Encumber", "61", "The authority records a charge on the parcel, such as a mortgage or an easement."],
    ["Release", "62", "The authority, or the holder of the encumbrance, removes it."],
    ["Set status", "63", "The authority changes the parcel's status, for example for a court order."],
  ];
</script>

<svelte:head>
  <title>Land Registry · Aletheia Explorer</title>
  <meta name="description" content="The land registry of the Sovereign Covenant State on StableChain: parcels, transfers, encumbrances and a history that can never be rewritten." />
</svelte:head>

<TopicHero
  eyebrow="Sovereign Services"
  title="Land Registry"
  lede="Every parcel of the State is recorded on StableChain with its controller, its class, its charges and its complete history. Each change is a signed transaction in a final block, so the registry's history can be proven and never quietly rewritten."
  keys={[
    { icon: "shield", label: "Kept by", value: "Land authorities named by governance" },
    { icon: "layers", label: "History", value: "Append-only, provable entry by entry" },
    { icon: "vault", label: "Boundaries", value: "Committed by hash, surveyed off chain" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="A parcel's life" wide>
    <Flow
      steps={[
        { name: "Registered", text: "The land authority records the parcel and its first controller." },
        { name: "Transferred", text: "The controller signs a transfer; restricted classes also need the authority's co-signature." },
        { name: "Encumbered", text: "Mortgages and easements are recorded against it." },
        { name: "Released", text: "A charge is lifted by the authority or by its holder.", tone: "ok" },
      ]}
    />
  </Topic>

  <Topic n={2} title="What each operation does" wide>
    <div class="table-wrap">
      <table class="scan">
        <thead><tr><th>Operation</th><th>Type</th><th>Who and what</th></tr></thead>
        <tbody>
          {#each operations as [name, type, what] (name)}
            <tr><td><strong>{name}</strong></td><td class="mono">{type}</td><td class="wrap">{what}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Topic>

  <Topic n={3} title="Who may do what">
    <Facts
      columns={1}
      items={[
        ["Land authorities", "Only governance can register a land authority, and only for the parcel classes in its scope. Every registration, encumbrance and status change comes from the authority's controller account."],
        ["Controllers", "A parcel's controller is an account, or the controller of an active registered identity. Only the controller can transfer it."],
        ["Co-signed transfers", "For restricted classes, the authority signs one specific transfer (parcel, new controller, sender and nonce), so its signature cannot be reused for another."],
      ]}
    />
  </Topic>

  <Topic n={4} title="What is on the ledger">
    <Facts
      columns={1}
      items={[
        ["Recorded on chain", "The parcel's identifier, class, controller, status, encumbrances, the authority, and a commitment to its boundaries."],
        ["Kept off chain", "The survey, plans and deeds stay with the land authority. The commitment lets anyone holding them prove they match the registry."],
        ["History", "Every operation appends a numbered history entry that is never rewritten, and can be proven against any block's state root."],
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
