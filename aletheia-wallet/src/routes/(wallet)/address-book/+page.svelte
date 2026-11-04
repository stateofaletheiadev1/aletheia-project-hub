<script lang="ts">
  // Address book (wallet prompt 8): alphabetised, local, validated on every read; entries from
  // another network or with a broken checksum are flagged and cannot be used to send.
  import { onMount } from "svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import AddressField from "$lib/components/inputs/AddressField.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import Dialog from "$lib/components/overlays/Dialog.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { config } from "$lib/config";
  import { addressProblem } from "$lib/stablechain/addresses/identifiers";
  import { contacts } from "$lib/state/contacts.svelte";
  import type { Contact } from "$lib/storage/db";

  let editingId = $state<string | null>(null);
  let name = $state("");
  let address = $state("");
  let note = $state("");
  let touched = $state(false);
  let open = $state(false);
  let removing = $state<Contact | null>(null);
  let confirmRemove = $state(false);

  onMount(() => void contacts.load());

  const nameError = $derived(touched && !name.trim() ? "Give the contact a name." : null);
  const addressOk = $derived(addressProblem(address.trim(), config.network) === null);

  function edit(contact: Contact | null) {
    editingId = contact?.id ?? null;
    name = contact?.name ?? "";
    address = contact?.address ?? "";
    note = contact?.note ?? "";
    touched = false;
    open = true;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    touched = true;
    if (!name.trim() || !addressOk) return;
    await contacts.save({ ...(editingId ? { id: editingId } : {}), name, address, note });
    open = false;
  }

  const letters = $derived([...new Set(contacts.list.map((c) => c.name.charAt(0).toUpperCase()))]);
</script>

<svelte:head><title>Address book · Aletheia Wallet</title></svelte:head>

<div class="book">
  <header class="settle head">
    <div>
      <p class="eyebrow">Kept on this device</p>
      <h1>Address book</h1>
    </div>
    <Button variant="quiet" icon="plus" onclick={() => edit(null)}>Add contact</Button>
  </header>

  {#if contacts.list.length === 0}
    <EmptyState scene="certificate" title="No saved addresses">
      Save the addresses you send to often. Names stay on this device; the wallet checks each address against the
      network every time.
      {#snippet actions()}<Button variant="quiet" icon="plus" onclick={() => edit(null)}>Add the first contact</Button
        >{/snippet}
    </EmptyState>
  {:else}
    {#each letters as letter (letter)}
      <section class="letter">
        <h2 class="eyebrow">{letter}</h2>
        <ul>
          {#each contacts.list.filter((c) => c.name.charAt(0).toUpperCase() === letter) as contact (contact.id)}
            {@const valid = contacts.valid(contact)}
            <li class:invalid={!valid}>
              <div class="main">
                <p class="name">{contact.name}</p>
                <Identifier value={contact.address} label="{contact.name} address" truncate />
                {#if contact.note}<p class="micro">{contact.note}</p>{/if}
                {#if !valid}
                  <p class="flag">
                    <Icon name="warning" size={14} />
                    {contact.network !== config.network ? `Saved for ${contact.network}` : "Checksum does not verify"} — not
                    usable here
                  </p>
                {/if}
              </div>
              <div class="row-actions">
                {#if valid}<Button variant="quiet" href="/send?to={encodeURIComponent(contact.address)}" icon="send"
                    >Send</Button
                  >{/if}
                <Button variant="plain" onclick={() => edit(contact)}>Edit</Button>
                <Button variant="plain" onclick={() => ((removing = contact), (confirmRemove = true))}>Remove</Button>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<Dialog bind:open title={editingId ? "Edit contact" : "Add contact"}>
  <form id="contact-form" class="form" onsubmit={save} novalidate>
    <TextField label="Name" bind:value={name} error={nameError} autocomplete="off" />
    <AddressField bind:value={address} {touched} />
    <TextField label="Note (optional)" bind:value={note} autocomplete="off" />
    {#if touched && !addressOk}<InlineStatus tone="rejected" title="Address not saved"
        >Only canonical {config.network} addresses can be saved.</InlineStatus
      >{/if}
  </form>
  {#snippet actions()}
    <Button variant="plain" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" type="submit" form="contact-form">Save</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={confirmRemove} title="Remove contact?">
  <p>{removing?.name} will be removed from this device's address book. Nothing changes on the network.</p>
  {#snippet actions()}
    <Button variant="plain" onclick={() => (confirmRemove = false)}>Keep</Button>
    <Button
      variant="danger"
      onclick={async () => {
        if (removing) await contacts.remove(removing.id);
        confirmRemove = false;
      }}>Remove</Button
    >
  {/snippet}
</Dialog>

<style>
  .book {
    display: grid;
    gap: var(--space-8);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  .letter h2 {
    padding-bottom: var(--space-2);
    border-bottom: var(--hairline) solid var(--rule-strong);
    color: var(--ink-heading);
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-4) 0;
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .main {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .name {
    font-weight: 650;
    color: var(--ink-heading);
  }

  .invalid .name {
    color: var(--ink-muted);
  }

  .flag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--state-rejected);
    font-size: var(--type-micro);
    font-weight: 600;
  }

  .row-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: end;
  }

  .form {
    display: grid;
    gap: var(--space-5);
  }

  @media (max-width: 720px) {
    li {
      grid-template-columns: minmax(0, 1fr);
    }

    .row-actions {
      justify-content: start;
    }
  }
</style>
