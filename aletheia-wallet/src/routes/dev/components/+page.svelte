<script lang="ts">
  // Development gallery: every foundation and data component in its states, both themes via the
  // toggle. Not built into production (the load function 404s outside dev).
  import Denomination from "$lib/components/data/Denomination.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import NetworkSeal from "$lib/components/data/NetworkSeal.svelte";
  import AssetRoundel from "$lib/components/data/AssetRoundel.svelte";
  import StatusStation from "$lib/components/data/StatusStation.svelte";
  import SealMark from "$lib/components/data/SealMark.svelte";
  import Guilloche from "$lib/components/foundations/Guilloche.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import HoldButton from "$lib/components/inputs/HoldButton.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import RuledSkeleton from "$lib/components/feedback/RuledSkeleton.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import QrCode from "$lib/components/media/QrCode.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { ICONS, type IconName } from "$lib/design/icons/paths";
  import ThemeToggle from "$lib/layouts/ThemeToggle.svelte";

  let value = $state(1_284_551_250_000_000_000_000n);
  const sample = "alt:4E0dC17eD0b07f6b20245d00C1234Fd1E9D04574";
</script>

<div class="gallery">
  <header>
    <h1>Components</h1>
    <ThemeToggle />
  </header>
  <section>
    <h2>Icons</h2>
    <div class="icons">
      {#each Object.keys(ICONS) as name (name)}<span title={name}><Icon name={name as IconName} size={24} /></span
        >{/each}
    </div>
  </section>
  <section>
    <h2>Denomination (M-04)</h2>
    <Denomination units={value} decimals={18} size="hero" announce />
    <Button onclick={() => (value += 1_000_000_000_000_000_007n)}>Add</Button>
    <Denomination units={936750n} decimals={3} code="ALnT" size="secondary" />
    <Denomination units={2000n} decimals={3} code="ALnT" signed="out" />
  </section>
  <section>
    <h2>Identifier (M-06)</h2>
    <Identifier value={sample} /><Identifier value={sample} truncate />
  </section>
  <section class="row">
    <h2>Seals</h2>
    <NetworkSeal size={200} /><NetworkSeal size={56} compact /><AssetRoundel asset="AEY" size={96} /><AssetRoundel
      asset="ALnT"
      size={96}
    /><SealMark state="sealed" />
  </section>
  <section>
    <h2>Guilloché</h2>
    <Guilloche variant="band" /><Guilloche variant="ring" size={160} />
  </section>
  <section>
    <h2>Status station (S-5)</h2>
    <StatusStation station={3} />
    <StatusStation station={3} tone="delayed" note="Network is slower than usual; your transaction is not lost." />
    <StatusStation station={4} tone="finalized" />
    <StatusStation station={1} tone="rejected" />
  </section>
  <section class="row">
    <h2>Buttons</h2>
    <Button variant="primary" icon="send">Send</Button><Button>Receive</Button><Button variant="plain">Plain</Button
    ><Button variant="danger">Remove</Button><Button disabled>Disabled</Button>
  </section>
  <section>
    <h2>Hold</h2>
    <HoldButton label="Hold to sign" onconfirm={() => undefined} />
  </section>
  <section>
    <h2>Status</h2>
    <InlineStatus tone="verified" title="Finalized">At block 1,284,551.</InlineStatus>
    <InlineStatus tone="pending" title="Awaiting finality">Network is slower than usual.</InlineStatus>
    <InlineStatus tone="rejected" title="Declined">The account does not hold enough.</InlineStatus>
    <InlineStatus tone="planned" title="Planned">Hardware wallets.</InlineStatus>
  </section>
  <section>
    <h2>Skeleton (M-11)</h2>
    <RuledSkeleton />
  </section>
  <section>
    <h2>Empty</h2>
    <EmptyState title="No transfers yet">Written here as they happen.</EmptyState>
  </section>
  <section>
    <h2>QR</h2>
    <QrCode value="aletheia:{sample}?asset=ALnT&amount=2.5" label="Sample" size={200} />
  </section>
</div>

<style>
  .gallery {
    display: grid;
    gap: var(--space-10);
    padding: var(--space-10) var(--page-margin);
  }

  header {
    display: flex;
    justify-content: space-between;
  }

  section {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-6);
  }

  .row h2 {
    flex-basis: 100%;
  }

  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    color: var(--ink-heading);
  }
</style>
