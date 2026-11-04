<script lang="ts">
  import PublicShell from "$lib/layouts/PublicShell.svelte";
  let { children } = $props();
</script>

<PublicShell>{@render children()}</PublicShell>
