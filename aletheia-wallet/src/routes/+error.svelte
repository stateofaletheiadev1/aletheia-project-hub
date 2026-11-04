<script lang="ts">
  import { page } from "$app/state";
  import PublicShell from "$lib/layouts/PublicShell.svelte";
  import EmptyState from "$lib/components/feedback/EmptyState.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
</script>

<svelte:head
  ><title>{page.status === 404 ? "Not found" : "Error"} · Aletheia Wallet</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>

<PublicShell>
  <EmptyState scene="marker" title={page.status === 404 ? "This page is not in the ledger" : "Something went wrong"}>
    {page.error?.message ?? ""}
    {#snippet actions()}<Button variant="quiet" href="/">Return home</Button>{/snippet}
  </EmptyState>
</PublicShell>
