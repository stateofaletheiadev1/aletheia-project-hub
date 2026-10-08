<script lang="ts">
  import CopyButton from "$lib/components/CopyButton.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import StatTile from "$lib/components/StatTile.svelte";
  import Star from "$lib/components/Star.svelte";
  import { useLive } from "$lib/context";
  import { grouped, short } from "$lib/format/display";

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
  const share = (power: string) => (total > 0n ? Number((BigInt(power) * 10_000n) / total) / 100 : 0);
  // Quorum Q = N − F with F = ⌊(N − 1) / 3⌋ (spec 19.1, E-21).
  const n = $derived(set.validators.length);
  const quorum = $derived(n === 0 ? 1 : n - Math.floor((n - 1) / 3));
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
      <p class="total"><Star size={12} hole="var(--surface)" /> {single ? "This network has one block producer" : `A total of ${grouped(n)} validators in epoch ${grouped(set.epoch)}`}</p>
      <p class="sub">Blocks proposed are counted over the latest {grouped(window)} blocks.</p>
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
            <th scope="col">Consensus Key (BLS)</th>
            <th scope="col">Node Key</th>
            <th scope="col" class="r">Voting Power</th>
            <th scope="col" class="r">Share</th>
            <th scope="col" class="r">Blocks Proposed</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {#if single}
            <tr>
              <td><strong>Validator 0</strong> <span class="faint">(producer)</span></td>
              <td class="faint">Not recorded</td>
              <td class="faint">Not recorded</td>
              <td class="r faint">—</td>
              <td class="r num">100%</td>
              <td class="r num">{grouped(proposed[0] ?? 0)}</td>
              <td><span class="final"><Star size={10} /> Producing</span></td>
            </tr>
          {:else}
            {#each set.validators as v (v.index)}
              <tr>
                <td><strong>Validator {v.index}</strong></td>
                <td><span class="key"><span class="mono" title={v.consensusKey}>{short(v.consensusKey, 10, 6)}</span><CopyButton value={v.consensusKey} label="Copy consensus key" /></span></td>
                <td><span class="key"><span class="mono" title={v.nodeKey}>{short(v.nodeKey, 10, 6)}</span><CopyButton value={v.nodeKey} label="Copy node key" /></span></td>
                <td class="r num">{grouped(Number(v.votingPower))}</td>
                <td class="r num">{share(v.votingPower)}%</td>
                <td class="r num">{grouped(proposed[v.index] ?? 0)}</td>
                <td><span class="final"><Star size={10} /> Active</span></td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </article>
</section>

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
