<script lang="ts">
  import CopyButton from "$lib/components/CopyButton.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import Star from "$lib/components/Star.svelte";
  import { useLive } from "$lib/context";
  import Blazon from "$lib/components/Blazon.svelte";
  import Ident from "$lib/components/Ident.svelte";
  import { amountText, grouped, short } from "$lib/format/display";

  let { data } = $props();
  const live = useLive();
  const set = $derived(data.set);
  const single = $derived(set.mode === "single-producer");
  const total = $derived(BigInt(set.totalVotingPower));
  // Recent proposals keep counting while the page is open.
  const proposed = $derived.by(() => {
    if (live.blocks.length === 0) return data.proposed;
    const out: Record<number, number> = {};
    for (const b of live.blocks) out[b.proposer] = (out[b.proposer] ?? 0) + 1;
    return out;
  });
  const window = $derived(live.blocks.length || data.window);
  // Quorum Q = N − F with F = ⌊(N − 1) / 3⌋ (spec 19.1, E-21).
  const n = $derived(set.validators.length);
  const quorum = $derived(n === 0 ? 1 : n - Math.floor((n - 1) / 3));
  // Rewards (protocol version 2): pools, the period and each validator's work in it.
  const rewards = $derived(set.rewards ?? null);
  const totalCredit = $derived(set.validators.reduce((sum, v) => sum + BigInt(v.work?.credit ?? "0"), 0n));
  const workShare = (credit: string | undefined) =>
    totalCredit > 0n && credit ? Number((BigInt(credit) * 10_000n) / totalCredit) / 100 : 0;
  const slotsLeft = $derived(rewards ? Math.max(0, rewards.nextPayoutSlot - rewards.slot) : 0);
  const alnt = (units: string) => amountText(units, "ALnT");
  const aey = (units: string) => amountText(units, "AEY");
  const status = (v: (typeof set.validators)[number]) => v.registration?.status ?? "active";
</script>

<svelte:head><title>Validators · Aletheia Explorer</title></svelte:head>

<PageHead eyebrow="Consensus · epoch {grouped(set.epoch)}" title="Validators" />

<section class="container cards" aria-label="Validator figures">
  <StatTile icon="shield" label="Validators" value="{single ? 1 : n} active" note={single ? "Single producer" : "Recorded for this epoch"} />
  <StatTile icon="layers" label="Quorum" value={single ? "1 of 1" : `${quorum} of ${n}`} note="Signatures needed to finalize" />
  <StatTile icon="block" label="Epoch" value={grouped(set.epoch)} note="At block {grouped(set.height)}" />
  <StatTile icon="activity" label="Voting power" value={single ? "—" : grouped(Number(total))} note={single ? "Not recorded on this network" : "Total across the set"} />
</section>

<section class="container">
  <article class="panel register">
    <div class="bar">
      <p class="total">{single ? "This network has one block producer" : `A total of ${grouped(n)} validators in epoch ${grouped(set.epoch)}`}</p>
      <p class="sub">
        Blocks proposed are counted over the latest {grouped(window)} blocks. Work is the blocks a validator served this reward
        period minus the signatures it missed; rewards are split by it.
      </p>
    </div>

    {#if single}
      <p class="note">
        This {live.stats?.network ?? "devnet"} chain runs on a single producer: one node proposes and finalizes every block, and no
        validator set is recorded in state. Networks with independent validators list each one here, with its keys, voting power and
        signing record.
      </p>
    {/if}

    <div class="scan-wrap">
      <table class="scan">
        <thead>
          <tr>
            <th scope="col">Validator</th>
            <th scope="col">Operator</th>
            <th scope="col">Node Key</th>
            <th scope="col" class="r">Bond</th>
            <th scope="col" class="r">Work This Period</th>
            <th scope="col" class="r">Missed</th>
            <th scope="col" class="r">Blocks Proposed</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {#if single}
            <tr>
              <td><strong>Validator 0</strong> <span class="faint">(producer)</span></td>
              <td class="faint">The state</td>
              <td class="faint">Not recorded</td>
              <td class="r faint">—</td>
              <td class="r faint">—</td>
              <td class="r faint">—</td>
              <td class="r num">{grouped(proposed[0] ?? 0)}</td>
              <td><span class="final"><Star size={10} /> Producing</span></td>
            </tr>
          {:else}
            {#each set.validators as v (v.index)}
              <tr>
                <td>
                  <strong>Validator {v.index}</strong>
                  <span class="faint block" title={v.consensusKey}>BLS {short(v.consensusKey, 6, 4)}</span>
                </td>
                <td>
                  {#if v.registration}
                    <a class="cell-link party" href="/address/{encodeURIComponent(v.registration.operator)}"><Blazon address={v.registration.operator} size={14} /><Ident value={v.registration.operator} head={4} tail={4} /></a>
                    <span class="faint block key" title="Licence fingerprint (aletheia-cli validator licence-hash): {v.registration.metadataHash}">Licence {short(v.registration.metadataHash, 6, 4)}<CopyButton value={v.registration.metadataHash} label="Copy licence fingerprint" /></span>
                  {:else}
                    <span>The state</span>
                    <span class="faint block">Genesis validator</span>
                  {/if}
                </td>
                <td><span class="key"><span class="mono" title={v.nodeKey}>{short(v.nodeKey, 10, 6)}</span><CopyButton value={v.nodeKey} label="Copy node key" /></span></td>
                <td class="r num">
                  {#if v.registration}<span title={alnt(v.registration.bond).exact}>{alnt(v.registration.bond).text}</span> <span class="faint">ALnT</span>{:else}<span class="faint">—</span>{/if}
                </td>
                <td class="r num">
                  {#if v.work}{grouped(Number(v.work.credit))} <span class="faint">({workShare(v.work.credit)}%)</span>{:else}<span class="faint">—</span>{/if}
                </td>
                <td class="r num">{v.work ? grouped(Number(v.work.missed)) : "—"}</td>
                <td class="r num">{grouped(proposed[v.index] ?? 0)}</td>
                <td>
                  {#if status(v) === "active"}
                    <span class="final"><Star size={10} /> Active</span>
                  {:else}
                    <span class="state">{status(v)}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </article>
</section>

{#if rewards}
  <section class="container">
    <article class="panel rewards" aria-labelledby="rewards-title">
      <div class="bar">
        <h2 id="rewards-title" class="total">Validator rewards</h2>
        <p class="sub">
          Paid every {grouped(rewards.periodSlots)} slots from the fee pool and the reward pool, split by work. The share earned by the
          state's own validators goes to the state beneficiary.
        </p>
      </div>
      <dl class="facts">
        <div>
          <dt>Next payout</dt>
          <dd>Slot {grouped(rewards.nextPayoutSlot)} <span class="faint">· in {grouped(slotsLeft)} slots</span></dd>
        </div>
        <div>
          <dt>Reward pool</dt>
          <dd>
            <span title={alnt(rewards.pool.alnt).exact}>{alnt(rewards.pool.alnt).text}</span> ALnT
            <span class="key faint"><span class="mono" title={rewards.pool.address}>{short(rewards.pool.address, 8, 4)}</span><CopyButton value={rewards.pool.address} label="Copy reward pool address" /></span>
          </dd>
        </div>
        <div>
          <dt>Paid from the pool each period</dt>
          <dd><span title={alnt(rewards.poolPayout).exact}>{alnt(rewards.poolPayout).text}</span> ALnT</dd>
        </div>
        <div>
          <dt>Fees waiting</dt>
          <dd>
            <span title={alnt(rewards.fees.alnt).exact}>{alnt(rewards.fees.alnt).text}</span> ALnT
            <span class="faint">· <span title={aey(rewards.fees.aey).exact}>{aey(rewards.fees.aey).text}</span> AEY</span>
          </dd>
        </div>
        <div>
          <dt>State beneficiary</dt>
          <dd>
            {#if rewards.stateBeneficiary}
              <a class="cell-link party" href="/address/{encodeURIComponent(rewards.stateBeneficiary)}"><Blazon address={rewards.stateBeneficiary} size={14} /><Ident value={rewards.stateBeneficiary} head={4} tail={4} /></a>
            {:else}
              <span class="faint">Not set; the state's share stays in the pools</span>
            {/if}
          </dd>
        </div>
      </dl>
    </article>
  </section>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .register {
    padding: 0.5rem 0 0.75rem;
  }
  .bar {
    padding: 1rem 1.25rem;
  }
  .total {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .sub,
  .faint {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    font-weight: 500;
  }
  .sub {
    margin-top: 0.2rem;
  }
  .note {
    margin: 0 1.25rem 1rem;
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: var(--radius);
  }
  .rewards {
    margin-top: 1.25rem;
    padding: 0.5rem 0 1rem;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.9rem 1.5rem;
    padding: 0 1.25rem;
  }
  .facts dt {
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .facts dd {
    margin-top: 0.25rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .block {
    display: block;
  }
  .state {
    display: inline-block;
    padding: 0.18rem 0.5rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: capitalize;
    color: var(--text-faint);
    border: 1px solid currentColor;
    border-radius: 0.375rem;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .final {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.18rem 0.5rem 0.18rem 0.4rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.375rem;
  }
  @media (max-width: 68rem) {
    .cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 30rem) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
</style>
