<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		caption,
		credit,
		class: className = '',
		children
	}: { caption?: string; credit?: string; class?: string; children: Snippet } = $props();
</script>

<figure class="figure {className}">
	{@render children()}
	{#if caption || credit}
		<figcaption class="t-fine">
			{#if caption}<span>{caption}</span>{/if}
			{#if credit}<span class="credit">{credit}</span>{/if}
		</figcaption>
	{/if}
</figure>

<style>
	.figure {
		display: grid;
		gap: var(--space-3);
	}

	figcaption {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-2) var(--space-5);
		border-top: var(--hairline) solid var(--line);
		padding-top: var(--space-2);
	}

	.credit {
		text-transform: uppercase;
		letter-spacing: var(--track-meta);
	}
</style>
