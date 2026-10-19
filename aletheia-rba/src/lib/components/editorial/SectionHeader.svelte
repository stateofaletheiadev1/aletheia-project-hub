<script lang="ts">
	import type { Snippet } from 'svelte';
	import Heading from '../primitives/Heading.svelte';
	import Eyebrow from './Eyebrow.svelte';

	let {
		folio,
		eyebrow,
		title,
		level = 2,
		size,
		id,
		intro
	}: {
		folio?: string;
		eyebrow?: string;
		title: string;
		level?: 1 | 2 | 3;
		size?: 'display' | 'h1' | 'h2' | 'h3';
		id?: string;
		intro?: Snippet;
	} = $props();
</script>

<header class="section-header">
	{#if eyebrow}<Eyebrow {folio}>{eyebrow}</Eyebrow>{/if}
	<Heading {level} {size} {id}>{title}</Heading>
	{#if intro}<div class="intro t-lead measure">{@render intro()}</div>{/if}
</header>

<style>
	.section-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-bottom: var(--space-7);
	}

	.intro {
		color: var(--fg-muted);
	}
</style>
