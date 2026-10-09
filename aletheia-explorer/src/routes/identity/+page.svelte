<script lang="ts">
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";
</script>

<svelte:head>
  <title>Identity & Residence · Aletheia Explorer</title>
  <meta name="description" content="Identity, credentials and residence on StableChain: what issuers record, what never goes on chain, and how anyone can verify a credential." />
</svelte:head>

<TopicHero
  eyebrow="Sovereign Services"
  title="Identity & Residence"
  lede="The State's registries record that an identity, a credential or a residence exists and who issued it, so anyone can verify it. They never record the personal details themselves: those stay with the issuer and with the person they belong to."
  keys={[
    { icon: "shield", label: "Issued by", value: "Issuers named by governance" },
    { icon: "user", label: "Personal data", value: "Never on chain, only commitments" },
    { icon: "check", label: "Verification", value: "By anyone, against the ledger" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="How an identity is recorded" wide>
    <p>
      An identity issuer records an identity with its controller account and a <strong>commitment</strong>: a hash of the person's
      attributes. The attributes themselves stay with the issuer and the holder. Anyone shown the attributes can check them against
      the commitment on the ledger, and learns nothing from the ledger alone.
    </p>
    <Flow
      steps={[
        { name: "Created", text: "The issuer records the identity, its controller and the attributes commitment." },
        { name: "Updated", text: "The issuer records a new commitment when details change." },
        { name: "Key rotated", text: "The holder moves control to a new key without the issuer." },
        { name: "Status", text: "The issuer can suspend or revoke an identity; the record itself remains.", tone: "stop" },
      ]}
    />
  </Topic>

  <Topic n={2} title="Credentials">
    <Facts
      columns={1}
      items={[
        ["Issuing", "An issuer issues credentials within the schemas governance gave it, each tied to a position in the issuer's revocation list."],
        ["Revoking", "Revocation flips that position in the issuer's public revocation list, in batches. A verifier checks one bit to know whether a credential still stands."],
        ["Verifying", "Anyone holding a credential can check its issuer, its schema and its revocation status against the ledger, without asking the issuer."],
      ]}
    />
  </Topic>

  <Topic n={3} title="Residence">
    <Facts
      columns={1}
      items={[
        ["Permits", "A residence issuer records permits in the residence classes it is authorised for, each with its holder and expiry epoch."],
        ["Expiry", "Expiry is computed from the recorded epoch, never stored separately, so a permit cannot be shown as valid past its date."],
        ["History", "Every residence change appends a numbered history entry that is never rewritten and can be proven against any block."],
      ]}
    />
  </Topic>

  <Topic n={4} title="Who may write what" wide>
    <div class="table-wrap">
      <table class="scan">
        <thead><tr><th>Operation</th><th>Types</th><th>Permitted to</th></tr></thead>
        <tbody>
          <tr><td><strong>Create, update, suspend an identity</strong></td><td class="mono">48 · 49 · 50</td><td class="wrap">The identity issuer's controller, within its scope</td></tr>
          <tr><td><strong>Rotate an identity's key</strong></td><td class="mono">51</td><td class="wrap">The identity's own controller</td></tr>
          <tr><td><strong>Issue and revoke credentials</strong></td><td class="mono">52 · 53</td><td class="wrap">The issuer's controller, for its schemas</td></tr>
          <tr><td><strong>Issue and change residence</strong></td><td class="mono">56 · 57</td><td class="wrap">The residence issuer's controller, for its classes</td></tr>
          <tr><td><strong>Name an issuer</strong></td><td class="mono">Governance</td><td class="wrap">The council, with a one-epoch notice</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note">
      Each operation is permitted to exactly one party, checked before anything changes. A transaction from anyone else is refused
      and changes nothing.
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
  .note {
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm) !important;
    background: rgb(255 255 255 / 0.04);
    border-left: 2px solid var(--brand-gold);
    border-radius: 0 0.4rem 0.4rem 0;
  }
  @media (max-width: 64rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
