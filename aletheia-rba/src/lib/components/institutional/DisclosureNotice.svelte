<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A calm, typographic statement of current position: ruled, not an alarm banner.
	 * `allow` passes a claims-lint exemption reason through to the built HTML (ADR 0002).
	 */
	let {
		label = 'Current position',
		allow,
		children
	}: { label?: string; allow?: string; children: Snippet } = $props();
</script>

<aside class="notice" aria-label={label} data-claims-allow={allow}>
	<p class="t-meta notice__label">{label}</p>
	<div class="notice__body">{@render children()}</div>
</aside>

<style>
	.notice {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4) 0 var(--space-4) var(--space-5);
		border-left: 2px solid var(--fg);
	}

	.notice__label {
		color: var(--fg-muted);
	}

	.notice__body {
		font-size: var(--fs-lead);
		line-height: 1.45;
		max-width: 52ch;
	}
</style>
