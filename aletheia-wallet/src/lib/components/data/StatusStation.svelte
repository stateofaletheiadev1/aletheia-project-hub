<script lang="ts">
  // The finality rule (S-5). Ink travels between engraved stations only on real status events.
  // The node reports no separate "included" state (it serves finalized transactions only), so the
  // third station is "Accepted": the node's own ACCEPTED answer to submission (DDR-0004).
  let {
    station,
    tone = "progress",
    note = null,
  }: {
    station: 0 | 1 | 2 | 3 | 4;
    tone?: "progress" | "delayed" | "rejected" | "finalized" | "expired";
    note?: string | null;
  } = $props();

  const STATIONS = ["Signed", "Submitted", "Accepted", "Finalized"] as const;
  const fill = $derived(Math.max(0, Math.min(1, (station - 1) / (STATIONS.length - 1))));
  const current = $derived(STATIONS[Math.max(0, station - 1)] ?? "Signed");
  const summary = $derived(
    tone === "finalized"
      ? "Finalized"
      : tone === "rejected"
        ? `Stopped at ${current}`
        : tone === "expired"
          ? "Expired before inclusion"
          : tone === "delayed"
            ? `Awaiting finality, slower than usual`
            : station === 0
              ? "Not signed yet"
              : current,
  );
</script>

<div class="station-rule {tone}" role="group" aria-label="Transfer progress">
  <ol class="stations" style:--fill={fill}>
    {#each STATIONS as name, i (name)}
      {@const n = i + 1}
      <li
        class:reached={station >= n}
        class:current={station === n}
        class:failed={(tone === "rejected" || tone === "expired") && station === n}
      >
        <span class="mark" aria-hidden="true"></span>
        <span class="name eyebrow">{name}</span>
        <span class="visually-hidden">{station >= n ? "reached" : "not reached"}</span>
      </li>
    {/each}
  </ol>
  <p class="summary" role="status" aria-live="polite">
    <span class="eyebrow">Status</span>
    <span>{summary}</span>
    {#if note}<span class="note">{note}</span>{/if}
  </p>
</div>

<style>
  .station-rule {
    display: grid;
    gap: var(--space-4);
  }

  .stations {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding-top: var(--space-2);
  }

  .stations::before,
  .stations::after {
    content: "";
    position: absolute;
    top: calc(var(--space-2) + 6px);
    left: 12.5%;
    right: 12.5%;
    height: var(--rule-thick);
    background: var(--rule-hairline);
  }

  .stations::after {
    background: var(--ink-heading);
    transform-origin: left center;
    transform: scaleX(var(--fill));
    transition: transform var(--dur-ceremony) var(--ease-paper);
  }

  .finalized .stations::after {
    background: var(--state-verified);
  }

  .delayed .stations::after {
    background: var(--state-pending);
  }

  .rejected .stations::after,
  .expired .stations::after {
    background: var(--state-rejected);
  }

  li {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    text-align: center;
  }

  .mark {
    width: 14px;
    height: 14px;
    border-radius: var(--radius-round);
    background: var(--surface-page);
    border: var(--rule-thick) solid var(--rule-hairline);
    transition:
      border-color var(--dur-base) var(--ease-ink),
      background var(--dur-base) var(--ease-ink),
      transform var(--dur-base) var(--ease-seal);
  }

  .reached .mark {
    border-color: var(--ink-heading);
    background: var(--ink-heading);
  }

  .finalized .reached .mark {
    border-color: var(--state-verified);
    background: var(--state-verified);
  }

  .current .mark {
    transform: scale(1.18);
    background: var(--surface-page);
  }

  .delayed .current .mark {
    border-color: var(--state-pending);
  }

  .failed .mark {
    border-color: var(--state-rejected) !important;
    background: var(--state-rejected-tint) !important;
  }

  .name {
    color: var(--ink-muted);
  }

  .reached .name {
    color: var(--ink-heading);
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    color: var(--ink-primary);
    font-weight: 600;
  }

  .delayed .summary {
    color: var(--state-pending);
  }

  .rejected .summary,
  .expired .summary {
    color: var(--state-rejected);
  }

  .finalized .summary {
    color: var(--state-verified);
  }

  .note {
    flex-basis: 100%;
    font-weight: var(--type-body-weight);
    color: var(--ink-secondary);
  }

  :global(:root[data-motion="reduce"]) .stations::after {
    transition-duration: 150ms;
  }
</style>
