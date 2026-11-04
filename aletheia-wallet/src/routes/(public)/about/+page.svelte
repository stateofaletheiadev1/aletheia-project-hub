<script lang="ts">
  import Editorial from "$lib/layouts/Editorial.svelte";
  import Arms from "$lib/components/foundations/Arms.svelte";
  import { explorer } from "$lib/config";
</script>

<Editorial
  eyebrow="About"
  title="The private ledger of a sovereign state"
  lede="Aletheia Wallet is the official wallet for AletheiaChain, the public ledger of the Sovereign Covenant State of Aletheia. It is personal by design: your keys are made and kept in your hands."
  sections={[
    { id: "purpose", label: "Purpose" },
    { id: "ecosystem", label: "Within the State" },
    { id: "assets", label: "The two assets" },
    { id: "principles", label: "Principles" },
  ]}
>
  <section id="purpose">
    <Arms size={88} />
    <h2>Purpose</h2>
    <p>
      Where the Explorer is the public ledger, open to everyone, the wallet is the private one: the instrument with
      which an individual, business or institution holds and moves value on AletheiaChain.
    </p>
  </section>
  <section id="ecosystem">
    <h2>Within the State</h2>
    <ul>
      <li><strong>The State</strong> — stateofaletheia.org, the public face of Aletheia.</li>
      <li><strong>Government Operations</strong> — the workbench behind the public record.</li>
      <li><strong>The Reserve Bank of Aletheia</strong> — the monetary authority.</li>
      <li>
        <strong>The Explorer</strong> —
        <a href={explorer.home()} target="_blank" rel="noopener noreferrer">the public ledger</a>, where every finalized
        transfer can be inspected.
      </li>
      <li><strong>The Wallet</strong> — the private ledger, held by you.</li>
    </ul>
  </section>
  <section id="assets">
    <h2>The two assets</h2>
    <p>
      <strong>AEY, the Aletheian Guilder</strong>, is the settlement unit of AletheiaChain, with eighteen decimal
      places. Its issuance is governed by the Reserve Bank of Aletheia.
    </p>
    <p>
      <strong>ALnT, Aletheia Talent</strong>, is the network's utility asset, with three decimal places. It pays for
      execution and secures the validators.
    </p>
  </section>
  <section id="principles">
    <h2>Principles</h2>
    <ul>
      <li>Non-custodial: no one but you can move your funds, and no one can recover them for you.</li>
      <li>Verified: the wallet confirms the network's identity before every signature.</li>
      <li>Exact: amounts are never rounded or estimated.</li>
      <li>Honest: a transfer is called final only when the network has finalized it.</li>
    </ul>
    <p><em>Veritas in Foedere.</em></p>
  </section>
</Editorial>
