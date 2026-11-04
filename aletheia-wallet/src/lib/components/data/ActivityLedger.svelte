<script lang="ts">
  // The ruled ledger of transfers (wallet prompt 8.1, M-03). Rows draw in when new; existing rows
  // FLIP into place. Status is words plus icon, never colour alone.
  import { flip } from "svelte/animate";
  import Icon from "$lib/design/icons/Icon.svelte";
  import Denomination from "./Denomination.svelte";
  import Timestamp from "./Timestamp.svelte";
  import { middleEllipsis } from "$lib/formatting/identifier";
  import { groupWhole } from "$lib/formatting/amount";
  import { assetDecimals } from "$lib/state/ledger.svelte";
  import { contacts } from "$lib/state/contacts.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import type { ActivityRecord } from "$lib/storage/db";
  import { onMount } from "svelte";

  let { rows, grouped = false }: { rows: ActivityRecord[]; grouped?: boolean } = $props();

  let mountedAt = $state(Number.MAX_SAFE_INTEGER);
  onMount(() => {
    mountedAt = Date.now();
    void contacts.load();
  });

  const STATUS = {
    submitted: { label: "Awaiting finality", icon: "clock", tone: "pending" },
    finalized: { label: "Finalized", icon: "seal", tone: "verified" },
    "failed-on-chain": { label: "Failed on chain", icon: "warning", tone: "rejected" },
    expired: { label: "Expired", icon: "reject", tone: "rejected" },
    rejected: { label: "Declined", icon: "reject", tone: "rejected" },
  } as const;

  function counterparty(row: ActivityRecord) {
    const other = row.direction === "in" ? row.sender : row.recipient;
    const contact = contacts.byAddress(other);
    if (row.direction === "self") return { name: "Between your accounts", address: other };
    return contact ? { name: contact.name, address: other } : { name: null, address: other };
  }

  function dayOf(ms: number): string {
    return new Intl.DateTimeFormat(prefs.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(ms);
  }

  const sections = $derived.by(() => {
    if (!grouped) return [{ day: "", rows }];
    const out: { day: string; rows: ActivityRecord[] }[] = [];
    for (const row of rows) {
      const day = dayOf(row.seenAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(row);
      else out.push({ day, rows: [row] });
    }
    return out;
  });
</script>

<div class="ledger" role="table" aria-label="Transfers">
  <div class="head" role="row">
    <span role="columnheader" class="eyebrow">Counterparty</span>
    <span role="columnheader" class="eyebrow num">Amount</span>
    <span role="columnheader" class="eyebrow">Status</span>
    <span role="columnheader" class="eyebrow num">Block</span>
    <span role="columnheader" class="eyebrow">Time</span>
  </div>
  {#each sections as section (section.day)}
    {#if section.day}<div class="day eyebrow" role="row"><span role="cell">{section.day}</span></div>{/if}
    {#each section.rows as row (row.txId)}
      {@const status = STATUS[row.status]}
      {@const party = counterparty(row)}
      {@const short = middleEllipsis(party.address)}
      <a
        class="row"
        class:ledger-write={row.seenAt > mountedAt}
        href="/transactions/{encodeURIComponent(row.txId)}"
        role="row"
        animate:flip={{ duration: 260 }}
      >
        <span class="party" role="cell">
          <span class="dir {row.direction}" aria-hidden="true"
            ><Icon name={row.direction === "in" ? "arrow-in" : "arrow-out"} size={18} /></span
          >
          <span class="who">
            <span class="direction-word"
              >{row.direction === "in" ? "Received from" : row.direction === "out" ? "Sent to" : "Moved"}</span
            >
            {#if party.name}<span class="name">{party.name}</span>{/if}
            <span class="addr numerals" title={party.address}
              >{short.head}{#if short.tail}…{short.tail}{/if}</span
            >
          </span>
        </span>
        <span class="amount num" role="cell">
          <Denomination
            units={BigInt(row.amount)}
            decimals={assetDecimals(row.asset)}
            code={row.asset}
            signed={row.direction === "in" ? "in" : row.direction === "out" ? "out" : null}
          />
        </span>
        <span class="status {status.tone}" role="cell"
          ><Icon name={status.icon} size={16} /><span>{status.label}</span></span
        >
        <span class="block num numerals micro" role="cell"
          >{row.height !== null ? groupWhole(row.height, prefs.locale) : "—"}</span
        >
        <span class="time micro" role="cell"><Timestamp ms={row.finalizedAt ?? row.seenAt} mode="relative" /></span>
      </a>
    {/each}
  {/each}
</div>

<style>
  .ledger {
    display: grid;
  }

  .head,
  .row {
    display: grid;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.8fr);
    align-items: center;
    gap: var(--space-4);
  }

  .head {
    padding-bottom: var(--space-2);
    border-bottom: var(--hairline) solid var(--rule-strong);
  }

  .num {
    text-align: end;
    justify-self: end;
  }

  .day {
    padding: var(--space-6) 0 var(--space-2);
    color: var(--ink-heading);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .row {
    min-height: var(--row-height);
    padding-block: var(--space-2);
    border-bottom: var(--hairline) solid var(--ledger-rule);
    text-decoration: none;
    color: inherit;
    transition: background-color var(--dur-quick) var(--ease-ink);
  }

  .row:hover {
    background: var(--ledger-row-hover);
  }

  .party {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .dir {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    border: var(--hairline) solid var(--rule-hairline);
    border-radius: var(--radius-round);
    color: var(--ink-secondary);
  }

  .dir.in {
    color: var(--state-verified);
    border-color: currentColor;
  }

  .who {
    display: grid;
    min-width: 0;
    line-height: 1.3;
  }

  .direction-word {
    font-size: var(--type-micro);
    color: var(--ink-muted);
    font-weight: 600;
  }

  .name {
    font-weight: 650;
    color: var(--ink-heading);
  }

  .addr {
    font-size: var(--type-data);
    font-weight: 500;
    color: var(--ink-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .amount {
    font-size: 1rem;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--type-data);
    font-weight: 600;
  }

  .verified {
    color: var(--state-verified);
  }

  .pending {
    color: var(--state-pending);
  }

  .rejected {
    color: var(--state-rejected);
  }

  @media (max-width: 860px) {
    .head {
      display: none;
    }

    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "party amount" "status time";
      row-gap: var(--space-1);
      padding-block: var(--space-3);
    }

    .party {
      grid-area: party;
    }

    .amount {
      grid-area: amount;
    }

    .status {
      grid-area: status;
      padding-inline-start: calc(32px + var(--space-3));
    }

    .time {
      grid-area: time;
      justify-self: end;
    }

    .block {
      display: none;
    }
  }
</style>
