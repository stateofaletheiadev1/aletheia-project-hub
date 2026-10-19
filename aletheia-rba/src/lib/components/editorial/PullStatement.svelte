<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A large statement set off by the seal rule. Not a quotation: no invented attribution. */
	let { children, note }: { children: Snippet; note?: Snippet } = $props();
</script>

<figure class="pull">
	<blockquote class="statement">{@render children()}</blockquote>
	{#if note}<figcaption class="t-fine">{@render note()}</figcaption>{/if}
</figure>

<style>
	.pull {
		border-top: 4px double var(--ornament);
		padding-top: var(--space-6);
		display: grid;
		gap: var(--space-4);
	}

	.statement {
		font-size: var(--fs-h2);
		font-weight: 300;
		line-height: 1.2;
		letter-spacing: var(--track-heading);
		text-wrap: balance;
		max-width: 28ch;
	}
</style>
