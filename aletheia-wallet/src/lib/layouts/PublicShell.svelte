<script lang="ts">
  // Public pages: wordmark, quiet navigation, the open-wallet action, footer. No wallet code here.
  import type { Snippet } from "svelte";
  import Wordmark from "./Wordmark.svelte";
  import SiteFooter from "./SiteFooter.svelte";
  import ContourField from "$lib/components/foundations/ContourField.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import { page } from "$app/state";

  let { children, field = "wallet" }: { children: Snippet; field?: "landing" | "wallet" | "ceremony" } = $props();
  const links = [
    { href: "/about", label: "About" },
    { href: "/security", label: "Security" },
    { href: "/help", label: "Help" },
    { href: "/network", label: "Network" },
  ];
</script>

<a class="skip-link" href="#main">Skip to content</a>
<div class="public">
  <ContourField {field} />
  <header class="masthead">
    <Wordmark />
    <nav aria-label="Main">
      {#each links as link (link.href)}
        <a href={link.href} aria-current={page.url.pathname === link.href ? "page" : undefined}>{link.label}</a>
      {/each}
    </nav>
    <div class="end">
      <ThemeToggle />
      <a class="open" href="/unlock">Open wallet</a>
    </div>
  </header>
  <main id="main" style="view-transition-name: page">
    {@render children()}
  </main>
  <SiteFooter />
</div>

<style>
  .public {
    position: relative;
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
  }

  .masthead {
    position: relative;
    z-index: var(--z-content);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    padding: var(--space-6) var(--page-margin);
  }

  nav {
    display: flex;
    gap: var(--space-8);
    font-weight: 600;
    font-size: 0.9375rem;
  }

  nav a {
    color: var(--ink-secondary);
    text-decoration: none;
    padding-block: var(--space-2);
    border-bottom: var(--hairline) solid transparent;
  }

  nav a:hover,
  nav a[aria-current="page"] {
    color: var(--ink-heading);
    border-bottom-color: var(--rule-strong);
  }

  .end {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .open {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    border: var(--hairline) solid var(--rule-strong);
    border-radius: var(--radius-2);
    text-decoration: none;
    font-weight: 650;
    font-size: 0.875rem;
    color: var(--ink-heading);
  }

  .open:hover {
    background: var(--surface-sunken);
  }

  main {
    position: relative;
    z-index: var(--z-content);
    padding: 0 var(--page-margin);
  }

  @media (max-width: 900px) {
    nav {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .open {
      display: none;
    }
  }
</style>
