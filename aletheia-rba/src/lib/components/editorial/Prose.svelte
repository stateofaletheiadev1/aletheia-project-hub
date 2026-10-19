<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Long-form reading column for Markdown and legal pages. */
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div class="prose {className}">
	{@render children()}
</div>

<style>
	.prose {
		max-width: var(--measure);
	}

	.prose :global(> * + *) {
		margin-top: var(--space-4);
	}

	.prose :global(h2) {
		font-size: var(--fs-h3);
		font-weight: 500;
		margin-top: var(--space-7);
		padding-top: var(--space-4);
		border-top: var(--hairline) solid var(--line);
	}

	.prose :global(h3) {
		font-size: var(--fs-h4);
		font-weight: 650;
		margin-top: var(--space-6);
	}

	.prose :global(ul),
	.prose :global(ol) {
		padding-left: 1.25em;
	}

	.prose :global(li + li) {
		margin-top: var(--space-2);
	}

	.prose :global(li::marker) {
		color: var(--fg-muted);
	}

	.prose :global(blockquote) {
		border-left: 2px solid var(--line-strong);
		padding-left: var(--space-5);
		color: var(--fg-muted);
	}

	.prose :global(table) {
		width: 100%;
		font-size: 0.95em;
	}

	.prose :global(th),
	.prose :global(td) {
		text-align: left;
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		border-bottom: var(--hairline) solid var(--line);
		vertical-align: top;
	}

	.prose :global(th) {
		font-size: var(--fs-meta);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		border-bottom-color: var(--line-strong);
	}
</style>
