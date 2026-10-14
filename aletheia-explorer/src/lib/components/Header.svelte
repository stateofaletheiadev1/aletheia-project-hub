<script lang="ts">
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";
  import Icon from "./Icon.svelte";
  import Crest from "./Crest.svelte";
  import FlagNational from "./FlagNational.svelte";
  import CopyButton from "./CopyButton.svelte";
  import Star from "./Star.svelte";
  import type { Stats } from "$lib/types";

  let { stats, connected }: { stats: Stats | null; connected: boolean } = $props();
  let setupOpen = $state(false);
  let menuOpen = $state(false);
  afterNavigate(() => (menuOpen = false));

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/blocks", label: "Blocks" },
    { href: "/transactions", label: "Transactions" },
    { href: "/validators", label: "Validators" },
    { href: "/treasury", label: "Treasury" },
  ];

  const active = (href: string) => (href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href));
  const live = $derived(connected && (stats?.online ?? false));
  const feed = $derived(`${page.url.origin}/api/stream`);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && ((setupOpen = false), (menuOpen = false))} />

<header class="bar">
  <div class="container inner">
    <div class="left">
      <a href="/" class="brand" aria-label="Aletheia Explorer, home">
        <Crest size={34} />
        <span class="word">Aletheia<span class="sub">Explorer</span></span>
      </a>
      <span class="flag" title="Sovereign Covenant State of Aletheia"><FlagNational width={27} label="" /></span>
      <span class="network" title="Network">{(stats?.network ?? "devnet").toUpperCase()}</span>
      <button type="button" class="setup" onclick={() => (setupOpen = !setupOpen)} aria-expanded={setupOpen} aria-label="Network setup" title="Network setup">
        <Icon name="network" size={15} />
        <span class="setup-words">Network Setup</span>
      </button>
    </div>

    <nav aria-label="Main">
      {#each nav as item (item.href)}
        <a href={item.href} class:active={active(item.href)} aria-current={active(item.href) ? "page" : undefined}>{item.label}</a>
      {/each}
    </nav>

    <button type="button" class="menu-button" onclick={() => (menuOpen = !menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label="Menu">
      <Icon name={menuOpen ? "close" : "menu"} size={20} stroke={2} />
    </button>

    <div class="status" class:live title={live ? "Following finalized blocks live" : "Not connected to the node"}>
      {#if live}<span class="glint"><Star size={12} hole="var(--bg-deep)" /></span>{:else}<span class="dot"></span>{/if}
      {live ? "Live" : "Offline"}
    </div>
  </div>

  {#if menuOpen}
    <div class="container">
      <nav class="mobile panel" id="mobile-menu" aria-label="Main">
        {#each nav as item (item.href)}
          <a href={item.href} class:active={active(item.href)} aria-current={active(item.href) ? "page" : undefined}>
            {item.label}<Icon name="chevronRight" size={14} stroke={2} />
          </a>
        {/each}
        <button type="button" class="mobile-setup" onclick={() => ((menuOpen = false), (setupOpen = true))}>
          <Icon name="network" size={15} /> Network Setup · {(stats?.network ?? "devnet").toUpperCase()}
        </button>
      </nav>
    </div>
  {/if}

  {#if setupOpen}
    <div class="container">
      <div class="setup-panel panel" role="dialog" aria-label="Network setup">
        <div class="setup-head">
          <h2>Connect to Aletheia {stats?.network ?? ""}</h2>
          <button type="button" class="close" onclick={() => (setupOpen = false)} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <dl>
          <div><dt class="label">Network</dt><dd>{stats?.network ?? "—"}</dd></div>
          <div><dt class="label">Chain ID</dt><dd class="num">{stats?.chainId ?? "—"} <CopyButton value={String(stats?.chainId ?? "")} /></dd></div>
          <div><dt class="label">Protocol</dt><dd>Version {stats?.protocolVersion ?? "—"}</dd></div>
          <div><dt class="label">Native assets</dt><dd>AEY (Aletheian Guilder) · ALnT (Aletheia Talent)</dd></div>
          <div><dt class="label">Live feed</dt><dd class="mono">{feed} <CopyButton value={feed} /></dd></div>
        </dl>
        <p class="hint">Addresses start with <span class="mono">alt:</span>. Aletheia never uses the <span class="mono">0x</span> prefix.</p>
      </div>
    </div>
  {/if}
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgb(12 39 134 / 0.88);
    backdrop-filter: saturate(140%) blur(14px);
    border-top: 3px solid var(--brand-gold);
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 4.25rem;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  .word {
    display: flex;
    flex-direction: column;
    font-weight: 800;
    font-size: var(--fs-md);
    letter-spacing: -0.02em;
    line-height: 1.05;
  }
  .sub {
    font-size: var(--fs-2xs);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  .flag {
    margin-left: 0.5rem;
  }
  .network {
    padding: 0.22rem 0.55rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.6);
    border-radius: 0.375rem;
  }
  .setup {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.75rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.06);
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 0.5rem;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  /* Between tablet and wide screens the button keeps its globe and drops its words. */
  @media (max-width: 82rem) {
    .setup .setup-words {
      display: none;
    }
  }
  .setup:hover,
  .setup[aria-expanded="true"] {
    background: rgb(255 255 255 / 0.1);
    border-color: rgb(196 154 78 / 0.6);
    color: var(--text);
  }
  nav:not(.mobile) {
    display: flex;
    gap: 0.25rem;
  }
  nav:not(.mobile) a {
    position: relative;
    padding: 0.5rem 0.75rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text-soft);
    border-radius: 0.5rem;
    transition:
      color var(--quick) var(--ease),
      background var(--quick) var(--ease);
  }
  nav:not(.mobile) a:hover {
    color: var(--text);
    background: rgb(255 255 255 / 0.07);
  }
  nav:not(.mobile) a.active {
    color: var(--text);
  }
  nav:not(.mobile) a.active::after {
    content: "";
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: -0.9rem;
    height: 2px;
    border-radius: 2px;
    background: var(--brand-gold);
  }
  .status {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.45rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--text-faint);
  }
  .live {
    color: var(--brand-gold-bright);
  }
  .glint {
    display: inline-flex;
    animation: glint 2.4s var(--ease) infinite;
  }
  .menu-button {
    display: none;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    margin-left: auto;
    border-radius: 0.6rem;
    border: 1px solid rgb(196 154 78 / 0.5);
    background: var(--brand-navy);
    color: var(--brand-cream);
    cursor: pointer;
  }
  .mobile {
    display: grid;
    margin: 0.75rem 0 1rem;
    padding: 0.5rem;
    animation: ink-in var(--calm) var(--ease);
  }
  .mobile a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 0.9rem;
    font-size: var(--fs-base);
    font-weight: 700;
    color: var(--text-soft);
    border-bottom: 1px solid rgb(255 255 255 / 0.07);
  }
  .mobile a.active {
    color: var(--brand-gold-bright);
  }
  .mobile-setup {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.6rem 0.4rem 0.3rem;
    padding: 0.7rem 0.9rem;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.5);
    border-radius: 0.55rem;
    cursor: pointer;
  }
  .setup-panel {
    margin: 0.75rem 0 1rem;
    padding: 1.25rem 1.5rem;
    max-width: 40rem;
    animation: ink-in var(--calm) var(--ease);
  }
  .setup-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  h2 {
    font-size: var(--fs-md);
    font-weight: 800;
    text-transform: capitalize;
  }
  .close {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: 0.5rem;
    background: rgb(255 255 255 / 0.06);
    cursor: pointer;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  dl div {
    display: grid;
    grid-template-columns: 8rem 1fr;
    align-items: center;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.06);
  }
  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 600;
    word-break: break-all;
  }
  .hint {
    margin-top: 0.875rem;
    font-size: var(--fs-sm);
    color: var(--text-faint);
  }
  @media (max-width: 60rem) {
    .setup,
    .status {
      display: none;
    }
    nav:not(.mobile) a {
      padding: 0.5rem;
    }
  }
  @media (max-width: 52rem) {
    nav:not(.mobile) {
      display: none;
    }
    .menu-button {
      display: grid;
    }
  }
  @media (max-width: 40rem) {
    .word .sub,
    .flag,
    .network {
      display: none;
    }
  }
</style>
