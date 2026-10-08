<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import Badge from "$lib/components/Badge.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Overview from "$lib/components/Overview.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import Row from "$lib/components/Row.svelte";
  import Star from "$lib/components/Star.svelte";
  import { amountText, grouped } from "$lib/format/display";
  import type { Supply } from "$lib/types";

  let { data } = $props();

  // The statement refreshes while the page is open, but only re-renders when the figures
  // actually changed, so the page never shifts under the reader.
  onMount(() => {
    const timer = setInterval(async () => {
      const response = await fetch("/api/supply").catch(() => null);
      if (!response?.ok) return;
      const fresh = (await response.json()) as { fingerprint: string };
      if (fresh.fingerprint !== fingerprint) void invalidateAll();
    }, 5_000);
    return () => clearInterval(timer);
  });
  const fingerprint = $derived(data.ledgers.map((l) => `${l.asset}:${l.issuedTotal}:${l.burnedTotal}:${l.circulating}:${l.locked}`).join("|"));

  const NAMES: Record<string, string> = { AEY: "Aletheian Guilder", ALnT: "Aletheia Talent" };
  const ROLES: Record<string, string> = {
    AEY: "Legal tender of the Sovereign Covenant State of Aletheia, in banknotes and on StableChain.",
    ALnT: "The network's utility and staking asset; it pays transaction fees.",
  };

  type Part = { key: keyof Supply; label: string; tone: string };
  const PARTS: Part[] = [
    { key: "circulating", label: "Circulating", tone: "gold" },
    { key: "locked", label: "Locked", tone: "cream" },
    { key: "reserved", label: "Reserved", tone: "laurel" },
    { key: "bridgeEscrow", label: "Bridge escrow", tone: "accent" },
    { key: "physicalCashOutstanding", label: "Banknotes outstanding", tone: "navy" },
  ];

  function statement(ledger: Supply) {
    const n = (key: keyof Supply) => BigInt(String(ledger[key]));
    const outstanding = n("issuedTotal") - n("burnedTotal");
    const held = PARTS.reduce((sum, p) => sum + n(p.key), 0n);
    const capacity = n("authorizedCapacity");
    const checks = [
      { id: "I1", ok: outstanding >= 0n, text: "Outstanding supply is everything issued minus everything burned." },
      { id: "I2", ok: outstanding === held, text: "Every unit outstanding is accounted for: circulating, locked, reserved, in bridge escrow or as banknotes." },
      { id: "I3", ok: outstanding <= capacity, text: "Outstanding supply stays within the authorized capacity." },
      { id: "I5", ok: n("redeemedTotal") <= n("burnedTotal"), text: "Nothing is redeemed that was not first burned." },
    ];
    const share = (key: keyof Supply) => (outstanding > 0n ? Number((n(key) * 10_000n) / outstanding) / 100 : 0);
    return { outstanding: outstanding.toString(), capacity: capacity.toString(), checks, share };
  }
  const fmt = (units: string, asset: string) => amountText(units, asset);
</script>

<svelte:head><title>Treasury · Aletheia Explorer</title></svelte:head>

<PageHead
  eyebrow="Sovereign Covenant State of Aletheia · National Treasury"
  title="Treasury statement"
  lede="Supply of the State's assets, read from the latest finalized state, with each supply rule checked in plain words."
/>

<section class="container ledgers">
  {#each data.ledgers as ledger (ledger.asset)}
    {@const s = statement(ledger)}
    {@const out = fmt(s.outstanding, ledger.asset)}
    <article class="panel ledger">
      <header>
        <span class="plate"><Icon name="vault" size={20} /></span>
        <div>
          <h2>{NAMES[ledger.asset] ?? ledger.asset} <span class="code">{ledger.asset}</span></h2>
          <p class="role">{ROLES[ledger.asset] ?? ""}</p>
        </div>
        <Badge tone="final"><Star size={10} /> Block {grouped(ledger.height)}</Badge>
      </header>

      <div class="headline">
        <span class="label">Outstanding</span>
        <p class="figure num" title="{out.exact} {ledger.asset}">{out.text}<span class="unit">{ledger.asset}</span></p>
      </div>

      <div class="bar" role="img" aria-label="Where the outstanding supply is held">
        {#each PARTS as part (part.key)}
          {#if s.share(part.key) > 0}<span class="seg {part.tone}" style:width="{s.share(part.key)}%" title="{part.label}: {s.share(part.key)}%"></span>{/if}
        {/each}
      </div>

      <Overview>
        {#each PARTS as part (part.key)}
          {@const v = fmt(String(ledger[part.key]), ledger.asset)}
          <Row label={part.label}>
            <span class="line num"><span class="dot {part.tone}"></span>{v.text} <span class="unit">{ledger.asset}</span> <span class="faint">{s.share(part.key)}%</span></span>
          </Row>
        {/each}
        <hr />
        <Row label="Issued in total" hint="Everything ever issued; never decreases."><span class="num">{fmt(ledger.issuedTotal, ledger.asset).text}</span></Row>
        <Row label="Burned in total" hint="Everything ever burned; never decreases."><span class="num">{fmt(ledger.burnedTotal, ledger.asset).text}</span></Row>
        <Row label="Redeemed in total" hint="Burned against payment out of the reserve."><span class="num">{fmt(ledger.redeemedTotal, ledger.asset).text}</span></Row>
        <Row label="Authorized capacity" hint="The most that may be outstanding, set by the State's monetary authority.">
          <span class="num">{fmt(s.capacity, ledger.asset).text}</span>
        </Row>
      </Overview>

      <div class="checks">
        <p class="label">Supply rules at this block</p>
        <ul>
          {#each s.checks as check (check.id)}
            <li class:bad={!check.ok}>
              <span class="mark">{#if check.ok}<Icon name="check" size={13} stroke={2.4} />{:else}<Icon name="alert" size={13} />{/if}</span>
              <span><strong>{check.id}</strong> {check.text}</span>
            </li>
          {/each}
        </ul>
      </div>
    </article>
  {/each}
</section>

<style>
  .ledgers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(30rem, 1fr));
    gap: 1.25rem;
  }
  /* Both statements share one layout: equal headers, so every row lines up across the two. */
  .ledgers {
    align-items: stretch;
  }
  .ledger {
    display: flex;
    flex-direction: column;
    padding: 1.4rem 1.5rem 1.25rem;
  }
  header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    align-items: center;
    padding-bottom: 1.1rem;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .plate {
    display: grid;
    place-items: center;
    width: 2.875rem;
    height: 2.875rem;
    border-radius: 0.75rem;
    color: var(--brand-gold-bright);
    background: linear-gradient(160deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.6);
  }
  h2 {
    font-size: var(--fs-md);
    font-weight: 800;
  }
  .code {
    margin-left: 0.3rem;
    font-size: var(--fs-xs);
    color: var(--gold);
  }
  .role {
    min-height: 3em;
    margin-top: 0.15rem;
    font-size: var(--fs-xs);
    line-height: 1.5;
    color: var(--text-faint);
  }
  .headline {
    padding: 1.3rem 0 0.9rem;
  }
  .figure {
    margin-top: 0.3rem;
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1;
  }
  .unit {
    margin-left: 0.45rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--gold);
  }
  .figure .unit {
    font-size: var(--fs-sm);
  }
  .bar {
    display: flex;
    height: 0.6rem;
    margin-bottom: 0.6rem;
    overflow: hidden;
    border-radius: 1rem;
    background: rgb(255 255 255 / 0.08);
    border: 1px solid rgb(196 154 78 / 0.35);
  }
  .seg {
    height: 100%;
  }
  .gold {
    background: var(--brand-gold);
  }
  .cream {
    background: var(--brand-cream);
  }
  .laurel {
    background: var(--brand-laurel-bright);
  }
  .accent {
    background: var(--accent);
  }
  .navy {
    background: var(--brand-navy);
    box-shadow: inset 0 0 0 1px rgb(196 154 78 / 0.6);
  }
  .line {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
  }
  .faint {
    color: var(--text-faint);
    font-weight: 500;
  }
  .checks {
    margin-top: auto;
    padding: 1rem 1.1rem;
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: var(--radius);
  }
  /* Space between the figures and the rules box, which sits at the foot of the card. */
  .ledger :global(.overview) {
    margin-bottom: 1rem;
  }
  .checks ul {
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .checks li {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--brand-cream);
  }
  .checks strong {
    color: var(--brand-gold-bright);
  }
  .mark {
    display: inline-grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
    margin-top: 0.05rem;
    border-radius: 50%;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.45);
  }
  .bad .mark {
    color: var(--fail);
    background: rgb(255 194 187 / 0.1);
    border-color: rgb(255 194 187 / 0.45);
  }
  @media (max-width: 36rem) {
    .ledgers {
      grid-template-columns: 1fr;
    }
    header {
      grid-template-columns: auto 1fr;
    }
  }
</style>
