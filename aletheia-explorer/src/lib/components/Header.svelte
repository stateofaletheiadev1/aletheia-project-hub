<script lang="ts">
  import { page } from "$app/state";
  import Icon from "./Icon.svelte";
  import Crest from "./Crest.svelte";
  import FlagNational from "./FlagNational.svelte";
  import CopyButton from "./CopyButton.svelte";
  import Star from "./Star.svelte";
  import type { Stats } from "$lib/types";

  let { stats, connected }: { stats: Stats | null; connected: boolean } = $props();
  let setupOpen = $state(false);

  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/blocks", label: "Blocks" },
    { href: "/transactions", label: "Transactions" },
    { href: "/treasury", label: "Treasury" },
  ];

  const active = (href: string) => (href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href));
  const live = $derived(connected && (stats?.online ?? false));
  const feed = $derived(`${page.url.origin}/api/stream`);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (setupOpen = false)} />

<header class="bar">
  <div class="container inner">
    <div class="left">
      <a href="/" class="brand" aria-label="Aletheia Explorer, home">
        <Crest size={34} />
        <span class="word">Aletheia<span class="sub">Explorer</span></span>
      </a>
      <span class="flag" title="Sovereign Covenant State of Aletheia"><FlagNational width={27} label="" /></span>
      <span class="network" title="Network">{(stats?.network ?? "devnet").toUpperCase()}</span>
      <button type="button" class="setup" onclick={() => (setupOpen = !setupOpen)} aria-expanded={setupOpen}>
        <Icon name="network" size={15} />
        Network Setup
      </button>
    </div>

    <nav aria-label="Main">
      {#each nav as item (item.href)}
        <a href={item.href} class:active={active(item.href)} aria-current={active(item.href) ? "page" : undefined}>{item.label}</a>
      {/each}
    </nav>

    <div class="status" class:live title={live ? "Following finalized blocks live" : "Not connected to the node"}>
      {#if live}<span class="glint"><Star size={12} hole="var(--bg-deep)" /></span>{:else}<span class="dot"></span>{/if}
      {live ? "Live" : "Offline"}
    </div>
  </div>

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
        <p class="hint">Addresses start with <span class="mono">AL:</span>. Aletheia never uses the <span class="mono">0x</span> prefix.</p>
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
    cursor: pointer;
    transition:
      background var(--quick) var(--ease),
      border-color var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  .setup:hover,
  .setup[aria-expanded="true"] {
    background: rgb(255 255 255 / 0.1);
    border-color: rgb(196 154 78 / 0.6);
    color: var(--text);
  }
  nav {
    display: flex;
    gap: 0.25rem;
  }
  nav a {
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
  nav a:hover {
    color: var(--text);
    background: rgb(255 255 255 / 0.07);
  }
  nav a.active {
    color: var(--text);
  }
  nav a.active::after {
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
    nav a {
      padding: 0.5rem;
    }
  }
  @media (max-width: 40rem) {
    .word .sub,
    .flag,
    .network {
      display: none;
    }
    nav a.active::after {
      bottom: -0.75rem;
    }
  }
</style>
