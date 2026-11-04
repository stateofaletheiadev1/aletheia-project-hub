<script lang="ts">
  // Network banner: shown only when the network is not live, in plain words.
  import Icon from "$lib/design/icons/Icon.svelte";
  import { network } from "$lib/state/network.svelte";

  const message = $derived(
    network.health === "unreachable"
      ? {
          tone: "rejected",
          text: "AletheiaChain is unreachable. Balances show the last finalized state seen; sending is paused.",
        }
      : network.health === "stalled"
        ? {
            tone: "pending",
            text: "No new finalized blocks for a few seconds. The network may be slow; nothing is lost.",
          }
        : network.health === "wrong-network"
          ? { tone: "rejected", text: "The node answered for a different network. Signing is off until it matches." }
          : null,
  );
</script>

{#if message}
  <div class="banner {message.tone}" role="status">
    <Icon name={message.tone === "pending" ? "clock" : "warning"} size={18} />
    <p>{message.text}</p>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--page-margin);
    border-bottom: var(--hairline) solid currentColor;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .pending {
    color: var(--state-pending);
    background: var(--state-pending-tint);
  }

  .rejected {
    color: var(--state-rejected);
    background: var(--state-rejected-tint);
  }
</style>
