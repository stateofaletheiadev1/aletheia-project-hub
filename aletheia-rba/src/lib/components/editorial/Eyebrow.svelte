<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Folio metadata: an optional section mark ("§ 02") followed by a tracked label. */
	let {
		folio,
		as = 'p',
		class: className = '',
		children
	}: { folio?: string; as?: string; class?: string; children: Snippet } = $props();
</script>

<svelte:element this={as} class="eyebrow t-meta {className}">
	{#if folio}<span class="folio">{folio}</span>{/if}
	<span>{@render children()}</span>
</svelte:element>

<style>
	.eyebrow {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		color: var(--fg-accent);
	}

	.folio {
		color: var(--fg-muted);
		font-weight: 500;
	}

	.folio::after {
		content: '';
		display: inline-block;
		width: 1.5rem;
		height: 1px;
		margin-left: var(--space-3);
		vertical-align: middle;
		background: var(--line-strong);
	}
</style>
