<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import { Live } from "$lib/live.svelte";
  import { provideLive } from "$lib/context";

  let { data, children } = $props();

  const live = new Live();
  // svelte-ignore state_referenced_locally
  live.seed(data.snapshot);
  provideLive(live);

  onMount(() => live.connect());
</script>

<div class="page">
  <a class="skip" href="#main">Skip to content</a>
  <Header stats={live.stats} connected={live.connected} />
  <main id="main">
    {@render children()}
  </main>
  <Footer protocolVersion={live.stats?.protocolVersion ?? 1} />
</div>

<style>
  .skip {
    position: absolute;
    left: 1rem;
    top: -3rem;
    z-index: 50;
    padding: 0.5rem 0.875rem;
    background: var(--button);
    color: var(--button-text);
    font-weight: 800;
    border-radius: 0.5rem;
  }
  .skip:focus {
    top: 0.75rem;
  }
  /* The footer always meets the bottom of the window, however short the page. */
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  main {
    flex: 1;
  }
</style>
