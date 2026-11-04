<script lang="ts">
  // The guard for the private ledger: no keystore → the landing; locked → unlock. While unlocked,
  // the network is watched and the active account's ledger is followed.
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import AppShell from "$lib/layouts/AppShell.svelte";
  import RuledSkeleton from "$lib/components/feedback/RuledSkeleton.svelte";
  import { session } from "$lib/state/session.svelte";
  import { network } from "$lib/state/network.svelte";
  import { ledger } from "$lib/state/ledger.svelte";

  let { children } = $props();

  onMount(() => {
    void session.load();
    const stopNetwork = network.use();
    return () => {
      stopNetwork();
      ledger.stop();
    };
  });

  $effect(() => {
    if (session.phase === "empty") void goto("/", { replaceState: true });
    else if (session.phase === "locked") void goto("/unlock", { replaceState: true });
  });

  $effect(() => {
    const address = session.phase === "unlocked" ? session.active?.address : null;
    if (address) void ledger.start(address);
  });
</script>

{#if session.phase === "unlocked"}
  <AppShell>{@render children()}</AppShell>
{:else}
  <div class="waiting"><RuledSkeleton rows={6} label="Opening the ledger" /></div>
{/if}

<style>
  .waiting {
    padding: var(--space-20) var(--page-margin);
    max-width: 900px;
  }
</style>
