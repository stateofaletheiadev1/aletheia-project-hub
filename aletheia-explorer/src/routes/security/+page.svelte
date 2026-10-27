<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import Star from "$lib/components/Star.svelte";

  const CSIRT = "https://www.stateofaletheia.org/adss/cybersecurity#disclosure";

  const inScope = [
    ["The node", "aletheiad: consensus, block execution, the mempool, peer-to-peer networking, storage and recovery."],
    ["The protocol", "StableChain's rules: transaction validity, fees, the AEY supply invariants, governance, registries, the payment network and the bridge."],
    ["The public RPC", "The REST and JSON-RPC interfaces at rpc.stateofaletheia.org, including input handling and rate limits."],
    ["Wallet and CLI", "aletheia-cli and the wallet library: key derivation, the encrypted keystore, signing and network checks."],
    ["This explorer", "aletheiascan.mainnet.stateofaletheia.org: what it displays, how it reads the node, and its browser security."],
    ["The State's platform", "stateofaletheia.org and its citizen and officer portals."],
  ];
  const outOfScope = [
    "Volumetric denial of service, or flooding any service with traffic.",
    "Social engineering, phishing or physical attacks on people, offices or data centres.",
    "Findings that need a compromised device, or an attacker who already holds a victim's keys.",
    "Automated scanner output without a demonstrated, concrete impact.",
    "Services run by third parties, such as exchanges or other wallets.",
  ];
  const severity = [
    {
      level: "Critical",
      tone: "crit",
      what: "Breaks consensus safety or the money: two conflicting blocks finalized, AEY created without authorisation, funds moved without the owner's signature, a supply invariant (I1–I15) bypassed, or validator keys exposed.",
    },
    {
      level: "High",
      tone: "high",
      what: "Halts the chain or a core service: finality stops, honest nodes crash on valid input, a governance or registry rule is bypassed, or the bridge accepts a message it should refuse.",
    },
    {
      level: "Medium",
      tone: "med",
      what: "Harms one node or service without breaking the chain: a crafted RPC request exhausts one node, the explorer can be made to display something untrue, or information leaks that should not.",
    },
    {
      level: "Low",
      tone: "low",
      what: "Defence-in-depth issues with limited impact: missing hardening headers, verbose errors, or weaknesses that need unlikely conditions.",
    },
  ];
  const protections = [
    ["Byzantine-fault-tolerant consensus", "A block is final only with a quorum certificate from the validator set and its successor's; finality cannot be reverted."],
    ["Supply invariants every block", "The AEY ledger checks I1–I15 after every block: issued, burned, held and escrowed amounts must reconcile, or the block is refused."],
    ["Keys stay with their owners", "Validator keys sit in a signer with a persistent record of what it signed; the RPC and explorer never hold keys and cannot move funds."],
    ["Network-bound signatures", "Every signature names the chain and the network, so a signature made for one network cannot be replayed on another."],
    ["Checksummed identifiers", "Addresses and identifiers carry a checksum in the case of their letters, as Ethereum addresses do, with the network folded in; a mistyped or foreign address is refused."],
    ["Finalized-only reads", "The RPC and this explorer serve finalized data only, so nothing shown can be rolled back."],
  ];
</script>

<svelte:head>
  <title>Security Policy · Aletheia Explorer</title>
  <meta name="description" content="How to report a vulnerability in Aletheia StableChain, its RPC, wallet, explorer or platform, and how reports are handled." />
</svelte:head>

<section class="hero container">
  <p class="eyebrow">Protocol resources</p>
  <h1>Security Policy</h1>
  <p class="lede">
    Aletheia StableChain carries the legal tender of the Sovereign Covenant State. If you find a weakness in the chain, its
    software or the State's platform, please tell us privately so it can be fixed before anyone can misuse it. Reports go to the
    State's computer security incident response team, CSIRT-ALE.
  </p>
  <a class="report" href={CSIRT} target="_blank" rel="noopener noreferrer">
    <Icon name="shield" size={18} /> Report a vulnerability to CSIRT-ALE <Icon name="arrowRight" size={15} />
  </a>
</section>

<div class="container grid">
  <section class="panel block">
    <h2><span class="n">01</span> How to report</h2>
    <ol class="steps">
      <li><span class="step-n">1</span><div><strong>Use the official channel.</strong> Report through the CSIRT-ALE disclosure page on the State's website, and encrypt your findings with the CSIRT's published PGP key.</div></li>
      <li><span class="step-n">2</span><div><strong>Describe what you found.</strong> The component and version (or commit), the steps to reproduce it, what an attacker could achieve, and a proof of concept if you have one.</div></li>
      <li><span class="step-n">3</span><div><strong>Keep it private.</strong> Do not publish, share or exploit the issue until it has been fixed and a disclosure date agreed with you.</div></li>
      <li><span class="step-n">4</span><div><strong>Leave personal data out.</strong> If a finding exposes anyone's data, stop, keep no copy, and say so in your report.</div></li>
    </ol>
  </section>

  <section class="panel block">
    <h2><span class="n">02</span> What happens next</h2>
    <div class="flow">
      {#each [["Acknowledged", "Your report is confirmed as received."], ["Triaged", "Its severity and scope are assessed with you."], ["Fixed", "A fix is prepared, tested and deployed; for the chain, through a coordinated release."], ["Disclosed", "The issue is published on an agreed date, crediting you if you wish."]] as [step, text], i (step)}
        <div class="stage">
          <span class="dot">{i + 1}</span>
          <strong>{step}</strong>
          <span>{text}</span>
        </div>
      {/each}
    </div>
    <p class="note">The State runs a bug bounty for responsible disclosures; its terms and awards are published by CSIRT-ALE.</p>
  </section>

  <section class="panel block wide">
    <h2><span class="n">03</span> Scope</h2>
    <div class="scope">
      <div>
        <h3><Icon name="check" size={15} stroke={2.4} /> In scope</h3>
        <ul class="in">
          {#each inScope as [name, desc] (name)}
            <li><strong>{name}</strong><span>{desc}</span></li>
          {/each}
        </ul>
      </div>
      <div>
        <h3 class="out-h"><Icon name="close" size={15} stroke={2.4} /> Out of scope</h3>
        <ul class="out">
          {#each outOfScope as item (item)}
            <li>{item}</li>
          {/each}
        </ul>
      </div>
    </div>
  </section>

  <section class="panel block wide">
    <h2><span class="n">04</span> How severity is judged</h2>
    <div class="sev">
      {#each severity as s (s.level)}
        <div class="sev-row {s.tone}">
          <span class="sev-level">{s.level}</span>
          <span class="sev-what">{s.what}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel block wide">
    <h2><span class="n">05</span> Rules for research</h2>
    <div class="rules">
      <div><Icon name="check" size={16} stroke={2.4} /><span><strong>Test on a devnet or your own node.</strong> The node runs a local development network in minutes; everything public on the chain can be reproduced there.</span></div>
      <div><Icon name="check" size={16} stroke={2.4} /><span><strong>Touch only your own accounts.</strong> Never move, freeze or read anyone else's funds or data.</span></div>
      <div><Icon name="check" size={16} stroke={2.4} /><span><strong>Stop at proof.</strong> Show that an issue exists; do not use it further than that.</span></div>
      <div><Icon name="check" size={16} stroke={2.4} /><span><strong>Give time to fix.</strong> Agree a disclosure date with CSIRT-ALE before publishing anything.</span></div>
    </div>
  </section>

  <section class="panel block wide">
    <h2><span class="n">06</span> What already protects the chain</h2>
    <div class="protect">
      {#each protections as [title, text] (title)}
        <div class="p-card">
          <Star size={14} hole="var(--surface)" />
          <strong>{title}</strong>
          <span>{text}</span>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .hero {
    padding-top: 2.75rem;
    padding-bottom: 2rem;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  h1 {
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.035em;
  }
  .lede {
    margin-top: 0.7rem;
    max-width: 48rem;
    font-size: var(--fs-md);
    line-height: 1.65;
    color: var(--text-soft);
  }
  .report {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 1.4rem;
    padding: 0.75rem 1.2rem;
    font-size: var(--fs-sm);
    font-weight: 800;
    color: var(--button-text);
    background: var(--button);
    border-radius: 0.6rem;
    transition: background var(--quick) var(--ease);
  }
  .report:hover {
    background: var(--brand-cream);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .block {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding: 1.6rem 1.75rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding-bottom: 0.9rem;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .n {
    display: inline-grid;
    place-items: center;
    min-width: 2rem;
    height: 2rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.5rem;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.7rem;
    font-size: var(--fs-md);
    font-weight: 800;
    color: var(--brand-laurel-bright);
  }
  .out-h {
    color: var(--fail);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.8rem;
  }
  .steps li {
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
    font-size: var(--fs-base);
    line-height: 1.6;
    color: var(--text-soft);
  }
  .steps strong {
    color: var(--text);
  }
  .step-n {
    display: inline-grid;
    place-items: center;
    width: 1.7rem;
    height: 1.7rem;
    flex: none;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 50%;
  }
  .flow {
    display: grid;
    gap: 0.6rem;
  }
  .stage {
    display: grid;
    grid-template-columns: 2rem 7.5rem 1fr;
    gap: 0.8rem;
    align-items: center;
    padding: 0.75rem 0.9rem;
    font-size: var(--fs-sm);
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  .stage strong {
    color: var(--text);
  }
  .dot {
    display: inline-grid;
    place-items: center;
    width: 1.7rem;
    height: 1.7rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
    border-radius: 50%;
  }
  .note {
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border-left: 2px solid var(--brand-gold);
    border-radius: 0 0.4rem 0.4rem 0;
  }
  .scope {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 1.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .in li {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    gap: 0.8rem;
    padding: 0.7rem 0.9rem;
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  .in strong {
    color: var(--text);
  }
  .out li {
    padding: 0.7rem 0.9rem;
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--text-soft);
    background: rgb(255 194 187 / 0.05);
    border: 1px solid rgb(255 194 187 / 0.18);
    border-radius: var(--radius);
  }
  .sev {
    display: grid;
    gap: 0.5rem;
  }
  .sev-row {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.85rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-left-width: 3px;
    border-radius: var(--radius);
  }
  .sev-level {
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .crit {
    border-left-color: #ff8a80;
  }
  .crit .sev-level {
    color: #ffb4ab;
  }
  .high {
    border-left-color: var(--warn);
  }
  .high .sev-level {
    color: var(--warn);
  }
  .med {
    border-left-color: var(--brand-gold);
  }
  .med .sev-level {
    color: var(--brand-gold-bright);
  }
  .low {
    border-left-color: var(--accent);
  }
  .low .sev-level {
    color: var(--accent);
  }
  .rules {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .rules div {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--brand-laurel-bright);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  .rules span {
    color: var(--text-soft);
  }
  .rules strong {
    color: var(--text);
  }
  .protect {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.8rem;
  }
  .p-card {
    display: grid;
    gap: 0.4rem;
    align-content: start;
    padding: 1rem 1.1rem;
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--text-soft);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.4);
    border-radius: var(--radius);
  }
  .p-card strong {
    color: var(--text);
  }
  @media (max-width: 64rem) {
    .grid,
    .scope {
      grid-template-columns: 1fr;
    }
    .protect {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 40rem) {
    .protect,
    .rules {
      grid-template-columns: 1fr;
    }
    .in li,
    .sev-row,
    .stage {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
    .block {
      padding: 1.25rem 1.1rem;
    }
  }
</style>
