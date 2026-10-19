<script lang="ts">
	import type { Snippet } from 'svelte';
	import Guilloche from '../motion/Guilloche.svelte';

	/**
	 * An honest empty register: says what will appear here and how it will be announced.
	 */
	let {
		title,
		headingLevel = 3,
		seed = 7,
		children,
		actions
	}: {
		title: string;
		headingLevel?: 2 | 3 | 4;
		seed?: number;
		children: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="empty">
	<div class="mark" aria-hidden="true">
		<Guilloche kind="rosette" {seed} size={88} layers={2} />
	</div>
	<div class="body">
		<svelte:element this={`h${headingLevel}`} class="t-h4">{title}</svelte:element>
		<div class="text">{@render children()}</div>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
</div>

<style>
	.empty {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-5);
		align-items: start;
		padding-block: var(--space-6);
		border-top: var(--hairline) solid var(--line-strong);
		border-bottom: var(--hairline) solid var(--line);
	}

	.mark {
		width: 88px;
		opacity: 0.85;
	}

	.body {
		display: grid;
		gap: var(--space-3);
		max-width: 56ch;
	}

	.text {
		color: var(--fg-muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}

	@media (max-width: 479px) {
		.empty {
			grid-template-columns: 1fr;
		}

		.mark {
			width: 64px;
		}
	}
</style>
