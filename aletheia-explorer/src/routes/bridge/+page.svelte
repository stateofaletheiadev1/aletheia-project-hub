<script lang="ts">
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";
</script>

<svelte:head>
  <title>Cross-Chain Bridge · Aletheia Explorer</title>
  <meta name="description" content="How AEY and bridged assets move between AletheiaChain and other chains: escrow, guardian quorums, limits, delays and pauses." />
</svelte:head>

<TopicHero
  eyebrow="Assets & Payments"
  title="Cross-Chain Bridge"
  lede="The bridge carries AEY to other blockchains and brings it back, under rules that keep every guilder accounted for on Aletheia. AEY that leaves is held in escrow here, never destroyed, so the State's supply and its reserves always cover every holder, wherever they are."
  keys={[
    { icon: "shield", label: "Verified by", value: "A two-thirds quorum of guardians" },
    { icon: "vault", label: "Outbound AEY", value: "Held in bridge escrow, not burned" },
    { icon: "clock", label: "New routes", value: "Open paused, by governance" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="AEY leaving Aletheia" wide>
    <p>
      A holder sends AEY to a route. The AEY moves into the bridge escrow account and the supply ledger moves it from
      <strong>circulating</strong> to <strong>bridge escrow</strong>; nothing is created or destroyed. The outbound message is
      stored on chain with the route's next sequence number, and the remote chain issues the same amount there.
    </p>
    <Flow
      steps={[
        { name: "Sent", text: "The holder signs a bridge transfer naming the route, the remote recipient and the amount." },
        { name: "Checked", text: "Route open, asset allowed outbound, within limits, amount exactly convertible to the remote decimals." },
        { name: "Escrowed", text: "The AEY moves to bridge escrow; the fee goes to the fee pool." },
        { name: "Recorded", text: "The message is stored with the next sequence; a relayer carries it across.", tone: "ok" },
      ]}
    />
  </Topic>

  <Topic n={2} title="AEY coming back" wide>
    <p>
      When AEY is returned on the remote chain, a relayer brings the message to Aletheia with an attestation from the route's
      guardians. Only a valid quorum, in the right order, before the message expires, releases AEY from escrow to the recipient.
    </p>
    <Flow
      steps={[
        { name: "Attested", text: "Guardians sign the message; at least two thirds of the set must sign." },
        { name: "Verified", text: "The aggregate signature, the destination, the route and the expiry are checked." },
        { name: "In sequence", text: "The message must be the route's next one: none skipped, none replayed." },
        { name: "Released", text: "The AEY leaves escrow to the recipient; bridge escrow falls by the same amount.", tone: "ok" },
      ]}
    />
  </Topic>

  <Topic n={3} title="Safety controls">
    <Facts
      columns={1}
      items={[
        ["Limits per route", "Every route caps each transfer, the total moved per epoch, and its total exposure. Governance may raise a limit but never set it below what the route already carries."],
        ["Large transfers wait", "A transfer at or above the route's threshold is accepted but held for a delay before it settles. During the delay the guardians may flag it for review; a flagged transfer stays held."],
        ["Exact amounts only", "An amount that cannot be expressed exactly in the remote token's decimals is refused. There is no rounding and no dust."],
      ]}
    />
  </Topic>

  <Topic n={4} title="Pauses">
    <Facts
      columns={1}
      items={[
        ["What a pause does", "It stops new bridge messages only. It never moves or freezes balances already on Aletheia, and transfers already waiting still settle."],
        ["Who may pause", "The council, at once and until it resumes the route; or a quorum of the route's guardians, for a governed number of epochs, after which the pause lapses."],
        ["Automatic pause", "If a quorum ever signs two different messages for the same sequence, the conflicting proof itself pauses the route."],
      ]}
    />
  </Topic>

  <Topic n={5} title="The accounting rules" wide>
    <p>
      After every block the chain checks three invariants. A block that would break any of them is refused by every validator.
    </p>
    <div class="invariants">
      <div><span class="tag">I10</span><span>The bridge escrow account, the supply ledger's bridge-escrow figure and the sum over all routes always agree.</span></div>
      <div><span class="tag">I11</span><span>A bridged asset's supply on Aletheia never exceeds what has been verifiably locked on the remote chain, minus what was released.</span></div>
      <div><span class="tag">I12</span><span>Every route stays within its per-epoch and exposure limits.</span></div>
    </div>
  </Topic>

  <Topic n={6} title="Routes and guardians" wide>
    <p>
      Routes and guardian sets are created only by governance, with a four-epoch notice, and every new route opens paused until the
      council resumes it. A guardian set needs at least seven members on production networks and a two-thirds threshold; each
      guardian's key is proven when the set is registered and again every time it signs. Light-client verification of remote
      chains is planned to join guardian verification in a later protocol version.
    </p>
  </Topic>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .invariants {
    display: grid;
    gap: 0.6rem;
  }
  .invariants div {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    padding: 0.85rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.4);
    border-radius: var(--radius);
  }
  .tag {
    flex: none;
    min-width: 2.6rem;
    padding: 0.2rem 0.4rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    text-align: center;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
    border-radius: 0.35rem;
  }
  @media (max-width: 64rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
