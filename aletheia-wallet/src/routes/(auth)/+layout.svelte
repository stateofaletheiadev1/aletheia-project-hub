<script lang="ts">
  import { onMount } from "svelte";
  import { session } from "$lib/state/session.svelte";

  let { children } = $props();
  onMount(() => void session.load());
</script>

{@render children()}
