<script lang="ts">
  // The left ledger rail (wallet prompt 8.1): arms, account identity, the Network Seal with its
  // heartbeat, the engraved index, and the lock at the base. Persists across page turns (M-07).
  import { page } from "$app/state";
  import Icon from "$lib/design/icons/Icon.svelte";
  import type { IconName } from "$lib/design/icons/paths";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import NetworkSeal from "$lib/components/data/NetworkSeal.svelte";
  import Wordmark from "./Wordmark.svelte";
  import { config } from "$lib/config";
  import { networkLabel, isTestNetwork } from "$lib/stablechain/network/kind";
  import { groupWhole } from "$lib/formatting/amount";
  import { network } from "$lib/state/network.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { session } from "$lib/state/session.svelte";

  const INDEX: { href: string; label: string; icon: IconName }[] = [
    { href: "/dashboard", label: "Ledger", icon: "ledger" },
    { href: "/send", label: "Send", icon: "send" },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/activity", label: "Activity", icon: "activity" },
    { href: "/assets", label: "Assets", icon: "assets" },
    { href: "/accounts", label: "Accounts", icon: "accounts" },
    { href: "/address-book", label: "Address book", icon: "address-book" },
    { href: "/settings/security", label: "Security", icon: "security" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];

  const current = (href: string) =>
    page.url.pathname === href ||
    (href !== "/settings" && page.url.pathname.startsWith(`${href}/`)) ||
    (href === "/activity" && page.url.pathname.startsWith("/transactions"));
  const health = $derived(network.health);
</script>

<aside class="rail" aria-label="Wallet" style="view-transition-name: rail">
  {#if isTestNetwork(config.network)}
    <div class="test-band" role="note"><span class="eyebrow">Test network · {networkLabel(config.network)}</span></div>
  {/if}
  <div class="head">
    <Wordmark href="/dashboard" size={34} />
  </div>

  {#if session.active}
    <section class="identity" aria-label="Active account">
      <p class="eyebrow">{session.active.name}</p>
      <Identifier value={session.active.address} label="Your address" truncate />
    </section>
  {/if}

  <a class="network" href="/network" aria-label="Network status">
    <NetworkSeal size={58} compact />
    <span class="network-text">
      <span class="eyebrow">{networkLabel(config.network)}</span>
      <span class="micro numerals">
        {#if health === "live" && network.status}Block {groupWhole(
            network.status.finalizedHeight,
            prefs.locale,
          )}{:else if health === "stalled"}Finality paused{:else if health === "connecting"}Connecting…{:else}Unreachable{/if}
      </span>
    </span>
  </a>

  <nav aria-label="Wallet index">
    <ol class="index">
      {#each INDEX as item, i (item.href)}
        <li>
          <a href={item.href} aria-current={current(item.href) ? "page" : undefined}>
            <span class="numeral numerals" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
          </a>
        </li>
      {/each}
    </ol>
  </nav>

  <div class="base">
    <button type="button" class="lock" onclick={() => session.lock("manual")}>
      <Icon name="lock" size={18} />
      <span>Lock wallet</span>
    </button>
    <p class="motto"><em>Veritas in Foedere</em></p>
  </div>
</aside>

<style>
  .rail {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: var(--rail-width);
    height: 100dvh;
    padding: var(--space-6) var(--space-5) var(--space-5);
    background: var(--rail-bg);
    border-inline-end: var(--hairline) solid var(--rail-rule);
    overflow-y: auto;
    z-index: var(--z-sticky);
  }

  .test-band {
    margin: calc(var(--space-6) * -1) calc(var(--space-5) * -1) 0;
    padding: var(--space-2) var(--space-5);
    color: var(--test-band);
    background: repeating-linear-gradient(
      -45deg,
      transparent 0 6px,
      color-mix(in srgb, var(--test-band) 14%, transparent) 6px 8px
    );
    border-bottom: var(--hairline) solid var(--test-band);
  }

  .test-band .eyebrow {
    color: var(--test-band);
  }

  .identity {
    display: grid;
    gap: var(--space-1);
    padding-bottom: var(--space-5);
    border-bottom: var(--hairline) solid var(--rail-rule);
  }

  .network {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
    color: inherit;
  }

  .network-text {
    display: grid;
    gap: 2px;
  }

  .index {
    display: grid;
    gap: 1px;
  }

  .index a {
    position: relative;
    display: grid;
    grid-template-columns: 2.2ch 18px 1fr;
    align-items: center;
    gap: var(--space-3);
    min-height: 40px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-1);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--ink-secondary);
    transition:
      color var(--dur-quick) var(--ease-ink),
      background-color var(--dur-quick) var(--ease-ink);
  }

  .index a:hover {
    color: var(--ink-heading);
    background: var(--surface-sunken);
  }

  .index a[aria-current="page"] {
    color: var(--rail-index-active);
  }

  .index a[aria-current="page"]::before {
    content: "";
    position: absolute;
    inset-inline-start: calc(var(--space-5) * -1);
    top: 8px;
    bottom: 8px;
    width: var(--rule-thick);
    background: var(--accent-seal);
  }

  .numeral {
    font-size: var(--type-micro);
    font-weight: 600;
    color: var(--ink-muted);
  }

  .base {
    margin-top: auto;
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-5);
    border-top: var(--hairline) solid var(--rail-rule);
  }

  .lock {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 40px;
    padding: 0 var(--space-2);
    font-weight: 600;
    color: var(--ink-heading);
    border-radius: var(--radius-1);
  }

  .lock:hover {
    background: var(--surface-sunken);
  }

  .motto {
    font-size: var(--type-micro);
    color: var(--accent-seal-ink);
    padding-inline-start: var(--space-2);
  }
</style>
