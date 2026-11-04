<script lang="ts">
  // Accounts (wallet prompt 8): the derived accounts as a ledger — name, address, path — with
  // the next index added on request.
  import Identifier from "$lib/components/data/Identifier.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import { session } from "$lib/state/session.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { ledger } from "$lib/state/ledger.svelte";

  let name = $state("");
  let busy = $state(false);
  let problem = $state<string | null>(null);
  let editing = $state<number | null>(null);
  let rename = $state("");

  const sorted = $derived([...session.accounts].sort((a, b) => a.index - b.index));

  async function add(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    problem = null;
    try {
      const account = await session.addAccount(name.trim() || `Account ${session.accounts.length + 1}`);
      name = "";
      prefs.activeAccount = account.index;
    } catch (error) {
      problem = error instanceof Error ? error.message : "The account could not be added.";
    } finally {
      busy = false;
    }
  }

  function use(index: number) {
    prefs.activeAccount = index;
    ledger.stop();
  }

  async function saveName(index: number) {
    if (rename.trim()) await session.renameAccount(index, rename.trim());
    editing = null;
  }
</script>

<svelte:head><title>Accounts · Aletheia Wallet</title></svelte:head>

<div class="accounts">
  <header class="settle">
    <p class="eyebrow">Derived from your recovery phrase</p>
    <h1>Accounts</h1>
  </header>

  <ol class="list">
    {#each sorted as account (account.index)}
      {@const active = account.index === (session.active?.index ?? -1)}
      <li class:active class="settle" style:--settle-order={account.index}>
        <span class="index numerals">{String(account.index + 1).padStart(2, "0")}</span>
        <div class="main">
          {#if editing === account.index}
            <form class="rename" onsubmit={(e) => (e.preventDefault(), saveName(account.index))}>
              <TextField label="Account name" bind:value={rename} autocomplete="off" />
              <Button type="submit" variant="quiet">Save</Button>
            </form>
          {:else}
            <p class="name">
              {account.name}{#if active}<span class="eyebrow tag">Active</span>{/if}
            </p>
          {/if}
          <Identifier value={account.address} label="{account.name} address" />
          <p class="micro numerals">{account.path}</p>
        </div>
        <div class="row-actions">
          {#if !active}<Button variant="quiet" onclick={() => use(account.index)}>Use this account</Button>{/if}
          {#if session.keystoreVersion === 2 && editing !== account.index}
            <Button variant="plain" onclick={() => ((editing = account.index), (rename = account.name))}>Rename</Button>
          {/if}
        </div>
      </li>
    {/each}
  </ol>

  {#if session.keystoreVersion === 2}
    <form class="add" onsubmit={add}>
      <h2>Add the next account</h2>
      <p class="micro">
        Index {sorted.length + 1} on the same recovery phrase. It appears on chain with its first transfer.
      </p>
      <TextField label="Name" bind:value={name} placeholder="Account {sorted.length + 1}" autocomplete="off" />
      {#if problem}<InlineStatus tone="rejected" title="Not added">{problem}</InlineStatus>{/if}
      <Button type="submit" variant="quiet" icon="plus" {busy}>Add account</Button>
    </form>
  {:else}
    <InlineStatus tone="info" title="One account in this keystore"
      >A keystore from the command-line tool holds a single key. Restore from a recovery phrase to derive more.</InlineStatus
    >
  {/if}
</div>

<style>
  .accounts {
    display: grid;
    gap: var(--space-8);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .list {
    border-top: var(--hairline) solid var(--rule-strong);
  }

  li {
    display: grid;
    grid-template-columns: 3ch minmax(0, 1fr) auto;
    gap: var(--space-5);
    align-items: center;
    padding: var(--space-5) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  li.active {
    box-shadow: inset var(--rule-thick) 0 0 var(--accent-seal);
    padding-inline-start: var(--space-4);
  }

  .index {
    font-size: var(--type-micro);
    font-weight: 600;
    color: var(--ink-muted);
  }

  .main {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    font-weight: 650;
    color: var(--ink-heading);
  }

  .tag {
    color: var(--accent-seal-ink);
  }

  .rename {
    display: flex;
    align-items: end;
    gap: var(--space-3);
    max-width: 420px;
  }

  .row-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: end;
  }

  .add {
    display: grid;
    gap: var(--space-4);
    max-width: 460px;
    justify-items: start;
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 500;
  }

  @media (max-width: 720px) {
    li {
      grid-template-columns: 3ch minmax(0, 1fr);
    }

    .row-actions {
      grid-column: 2;
      justify-content: start;
    }
  }
</style>
