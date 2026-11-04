<script lang="ts">
  // Activity (wallet prompt 8): the full ruled ledger with a sticky filter bar, grouped by day.
  import ActivityLedger from "$lib/components/data/ActivityLedger.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { ledger } from "$lib/state/ledger.svelte";
  import { session } from "$lib/state/session.svelte";
  import { explorer } from "$lib/config";

  let direction = $state<"all" | "out" | "in">("all");
  let asset = $state<"all" | "AEY" | "ALnT">("all");
  let status = $state<"all" | "final" | "pending" | "problem">("all");
  const PAGE = 25;
  let shown = $state(PAGE);

  const rows = $derived(
    ledger.activity.filter(
      (r) =>
        (direction === "all" || r.direction === direction || (r.direction === "self" && direction === "out")) &&
        (asset === "all" || r.asset === asset) &&
        (status === "all" ||
          (status === "final" && r.status === "finalized") ||
          (status === "pending" && r.status === "submitted") ||
          (status === "problem" &&
            (r.status === "failed-on-chain" || r.status === "expired" || r.status === "rejected"))),
    ),
  );
  const filtering = $derived(direction !== "all" || asset !== "all" || status !== "all");
</script>

<svelte:head><title>Activity · Aletheia Wallet</title></svelte:head>

<div class="activity">
  <header class="settle">
    <p class="eyebrow">{session.active?.name} · Ledger</p>
    <h1>Activity</h1>
  </header>

  <div class="filters" role="search" aria-label="Filter transfers">
    <Icon name="filter" size={18} />
    <SegmentedControl
      label="Direction"
      hideLabel
      bind:value={direction}
      options={[
        { value: "all", label: "All" },
        { value: "out", label: "Sent" },
        { value: "in", label: "Received" },
      ]}
    />
    <SegmentedControl
      label="Asset"
      hideLabel
      bind:value={asset}
      options={[
        { value: "all", label: "Any asset" },
        { value: "AEY", label: "AEY" },
        { value: "ALnT", label: "ALnT" },
      ]}
    />
    <SegmentedControl
      label="Status"
      hideLabel
      bind:value={status}
      options={[
        { value: "all", label: "Any status" },
        { value: "final", label: "Finalized" },
        { value: "pending", label: "Pending" },
        { value: "problem", label: "Not completed" },
      ]}
    />
  </div>

  {#if rows.length}
    <ActivityLedger rows={rows.slice(0, shown)} grouped />
    {#if rows.length > shown}<Button variant="quiet" onclick={() => (shown += PAGE)}
        >Show {Math.min(PAGE, rows.length - shown)} more</Button
      >{:else if ledger.historyNext && !filtering}<Button
        variant="quiet"
        busy={ledger.loadingMore}
        onclick={async () => {
          await ledger.loadMore();
          shown += PAGE;
        }}>Load older transfers</Button
      >{/if}
  {:else if filtering}
    <EmptyState scene="marker" title="Nothing matches these filters">
      {#snippet actions()}<Button
          variant="quiet"
          onclick={() => ((direction = "all"), (asset = "all"), (status = "all"))}>Clear filters</Button
        >{/snippet}
    </EmptyState>
  {:else}
    <EmptyState scene="ledger" title="The ledger is open and empty"
      >Transfers you send, and those that arrive while the wallet is open, will be written here.</EmptyState
    >
  {/if}

  <p class="source micro">
    {#if ledger.historySupported}
      History read from AletheiaChain, newest first; new transfers appear as they are finalized. The same record is on
      the public ledger:
    {:else}
      {#if ledger.scanning}Reading recent blocks for transfers… ·{/if}
      This ledger records what this wallet has sent and seen. The complete history of the account is on the public ledger:
    {/if}
    {#if session.active}<a href={explorer.address(session.active.address)} target="_blank" rel="noopener noreferrer"
        >open in the Explorer ↗</a
      >{/if}
  </p>
</div>

<style>
  .activity {
    display: grid;
    gap: var(--space-8);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .filters {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding: var(--space-3) 0;
    background: var(--surface-page);
    border-bottom: var(--hairline) solid var(--rule-hairline);
    color: var(--ink-secondary);
  }

  .source {
    max-width: 72ch;
  }

  .source a {
    color: var(--ink-secondary);
    font-weight: 600;
  }

  @media (max-width: 1100px) {
    .filters {
      top: 64px;
    }
  }
</style>
