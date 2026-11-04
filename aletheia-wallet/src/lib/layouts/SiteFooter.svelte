<script lang="ts">
  import { config, explorer } from "$lib/config";
</script>

<footer class="footer">
  <div class="rule" aria-hidden="true"></div>
  <div class="inner">
    <p class="motto"><em>Veritas in Foedere</em></p>
    <nav aria-label="Footer">
      <a href="/about">About</a>
      <a href="/security">Security</a>
      <a href="/help">Help</a>
      <a href="/network">Network</a>
      <a href={explorer.home()} target="_blank" rel="noopener noreferrer">Explorer ↗</a>
    </nav>
    <p class="micro">Sovereign Covenant State of Aletheia · Build <span class="numerals">{config.buildHash}</span></p>
  </div>
</footer>

<style>
  .footer {
    position: relative;
    z-index: var(--z-content);
    padding: 0 var(--page-margin) var(--space-10);
  }

  .rule {
    height: var(--hairline);
    background: var(--rule-hairline);
    margin-bottom: var(--space-6);
  }

  .inner {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4) var(--space-8);
  }

  .motto {
    color: var(--accent-seal-ink);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-6);
    font-size: 0.875rem;
    font-weight: 600;
  }

  nav a {
    color: var(--ink-secondary);
    text-decoration: none;
    min-height: var(--target-min);
    display: inline-flex;
    align-items: center;
  }

  nav a:hover {
    color: var(--ink-heading);
  }
</style>
