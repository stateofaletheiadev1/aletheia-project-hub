<script lang="ts">
  // The wallet shell: the ledger rail on desktop, an identity strip on tablet, and a bottom action
  // bar on phones (wallet prompt 5.5).
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import LedgerRail from "./LedgerRail.svelte";
  import Wordmark from "./Wordmark.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import ContourField from "$lib/components/foundations/ContourField.svelte";
  import NetworkSeal from "$lib/components/data/NetworkSeal.svelte";
  import Banner from "$lib/components/feedback/Banner.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { session } from "$lib/state/session.svelte";
  import { config } from "$lib/config";
  import { isTestNetwork, networkLabel } from "$lib/stablechain/network/kind";

  let { children }: { children: Snippet } = $props();
  let menu = $state(false);
  $effect(() => {
    void page.url.pathname;
    menu = false;
  });
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="shell">
  <div class="rail-slot" id="wallet-rail" class:open={menu}>
    <LedgerRail />
  </div>

  <div class="strip">
    {#if isTestNetwork(config.network)}<span class="test eyebrow">Test network · {networkLabel(config.network)}</span
      >{/if}
    <Wordmark href="/dashboard" size={28} descriptor={false} />
    <div class="strip-end">
      <a href="/network" aria-label="Network status"><NetworkSeal size={40} compact /></a>
      <ThemeToggle />
      <button
        type="button"
        class="menu"
        onclick={() => (menu = !menu)}
        aria-expanded={menu}
        aria-controls="wallet-rail"
        aria-label={menu ? "Close menu" : "Open menu"}
      >
        <Icon name={menu ? "close" : "menu"} size={22} />
      </button>
    </div>
  </div>

  <div class="stage">
    <Banner />
    <ContourField field="wallet" />
    <div class="top-tools"><ThemeToggle /></div>
    <main id="main" style="view-transition-name: page">
      {@render children()}
    </main>
  </div>

  <nav class="action-bar" aria-label="Quick actions">
    <a href="/send" aria-current={page.url.pathname === "/send" ? "page" : undefined}
      ><Icon name="send" size={20} /><span>Send</span></a
    >
    <a href="/receive" aria-current={page.url.pathname === "/receive" ? "page" : undefined}
      ><Icon name="receive" size={20} /><span>Receive</span></a
    >
    <a href="/activity" aria-current={page.url.pathname === "/activity" ? "page" : undefined}
      ><Icon name="activity" size={20} /><span>Activity</span></a
    >
    <button type="button" onclick={() => session.lock("manual")}><Icon name="lock" size={20} /><span>Lock</span></button
    >
  </nav>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--rail-width) minmax(0, 1fr);
    min-height: 100dvh;
  }

  /* The rail's paper runs the full height of the page, not only the first screen. */
  .rail-slot {
    background: var(--rail-bg);
    border-inline-end: var(--hairline) solid var(--rail-rule);
  }

  .stage {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  .top-tools {
    position: absolute;
    top: var(--space-5);
    right: var(--page-margin);
    z-index: var(--z-sticky);
  }

  main {
    position: relative;
    z-index: var(--z-content);
    padding: var(--space-12) var(--page-margin) var(--space-20);
    max-width: 1280px;
  }

  .strip,
  .action-bar {
    display: none;
  }

  @media (max-width: 1100px) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
    }

    .rail-slot {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: var(--z-sheet);
      transform: translateX(-100%);
      transition: transform var(--dur-considered) var(--ease-paper);
      box-shadow: none;
    }

    .rail-slot.open {
      transform: none;
      border-inline-end: var(--hairline) solid var(--rule-strong);
    }

    .strip {
      position: sticky;
      top: 0;
      z-index: var(--z-bar);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
      padding: var(--space-3) var(--page-margin);
      background: var(--surface-rail);
      border-bottom: var(--hairline) solid var(--rule-hairline);
    }

    .test {
      flex-basis: 100%;
      color: var(--test-band);
    }

    .strip-end {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .menu {
      display: grid;
      place-items: center;
      width: var(--target-touch);
      height: var(--target-touch);
      color: var(--ink-heading);
    }

    .top-tools {
      display: none;
    }

    main {
      padding-top: var(--space-8);
    }
  }

  @media (max-width: 720px) {
    main {
      padding-bottom: calc(var(--bar-height) + var(--space-12));
    }

    .action-bar {
      position: fixed;
      inset: auto 0 0 0;
      z-index: var(--z-bar);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      height: calc(var(--bar-height) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--surface-rail);
      border-top: var(--hairline) solid var(--rule-hairline);
    }

    .action-bar a,
    .action-bar button {
      display: grid;
      place-items: center;
      align-content: center;
      gap: 2px;
      min-height: var(--target-touch);
      color: var(--ink-secondary);
      text-decoration: none;
      font-size: var(--type-micro);
      font-weight: 650;
    }

    .action-bar [aria-current="page"] {
      color: var(--ink-heading);
      box-shadow: inset 0 var(--rule-thick) 0 var(--accent-seal);
    }
  }
</style>
