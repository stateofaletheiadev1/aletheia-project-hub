<script lang="ts">
  // Absolute and relative time, locale-aware, in a <time> element (wallet prompt 9).
  import { prefs } from "$lib/state/prefs.svelte";
  import { onMount } from "svelte";

  let { ms, mode = "both" }: { ms: number; mode?: "both" | "absolute" | "relative" } = $props();

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const absolute = $derived(
    new Intl.DateTimeFormat(prefs.locale, { dateStyle: "medium", timeStyle: "medium" }).format(ms),
  );
  const relative = $derived.by(() => {
    const seconds = Math.round((ms - now) / 1000);
    const format = new Intl.RelativeTimeFormat(prefs.locale, { numeric: "auto" });
    const abs = Math.abs(seconds);
    if (abs < 45) return format.format(0, "second") === "now" ? "just now" : format.format(seconds, "second");
    if (abs < 3600) return format.format(Math.round(seconds / 60), "minute");
    if (abs < 86_400) return format.format(Math.round(seconds / 3600), "hour");
    return format.format(Math.round(seconds / 86_400), "day");
  });
</script>

<time datetime={new Date(ms).toISOString()} title={absolute} class="numerals">
  {#if mode === "relative"}{relative}{:else if mode === "absolute"}{absolute}{:else}{relative}<span class="abs">
      · {absolute}</span
    >{/if}
</time>

<style>
  .abs {
    color: var(--ink-muted);
  }
</style>
