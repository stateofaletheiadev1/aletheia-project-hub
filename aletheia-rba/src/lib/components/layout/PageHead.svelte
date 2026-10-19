<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Crumb } from '$lib/seo/jsonld';
	import Eyebrow from '../editorial/Eyebrow.svelte';
	import Guilloche from '../motion/Guilloche.svelte';
	import Breadcrumbs from './Breadcrumbs.svelte';

	/**
	 * Navy head of an inner page: breadcrumbs, folio, the page's single h1 and its lead. The
	 * masthead sits transparently over it. Each page passes its own seed, so the ground differs.
	 */
	let {
		trail,
		folio,
		eyebrow,
		title,
		seed = 1,
		lead,
		aside
	}: {
		trail: Crumb[];
		folio?: string;
		eyebrow?: string;
		title: string;
		seed?: number;
		lead?: Snippet;
		aside?: Snippet;
	} = $props();
</script>

<header class="head surface-navy">
	<div class="ground" aria-hidden="true">
		<Guilloche kind="lattice" {seed} width={1440} height={420} lines={30} strokeWidth={0.5} />
	</div>
	<div class="container head__inner">
		<Breadcrumbs {trail} />
		<div class="head__grid">
			<div class="head__main">
				{#if eyebrow}<Eyebrow {folio}>{eyebrow}</Eyebrow>{/if}
				<h1 class="t-h1">{title}</h1>
				{#if lead}<div class="t-lead head__lead">{@render lead()}</div>{/if}
			</div>
			{#if aside}<div class="head__aside">{@render aside()}</div>{/if}
		</div>
	</div>
</header>

<style>
	.head {
		position: relative;
		overflow: hidden;
		padding-top: calc(var(--masthead-h) + var(--space-5));
		padding-bottom: clamp(var(--space-8), 6vw, var(--space-10));
	}

	.ground {
		position: absolute;
		inset: auto 0 0;
		height: 70%;
		opacity: 0.16;
		pointer-events: none;
		mask-image: linear-gradient(to bottom, transparent, black 40%);
	}

	.ground :global(svg) {
		height: 100%;
	}

	.head__inner {
		position: relative;
		display: grid;
		gap: var(--space-7);
	}

	.head__grid {
		display: grid;
		gap: var(--space-6);
		align-items: end;
	}

	@media (min-width: 1024px) {
		.head__grid {
			grid-template-columns: 7fr 4fr;
			column-gap: calc(var(--gutter) * 2);
		}
	}

	.head__main {
		display: grid;
		gap: var(--space-5);
	}

	.head__main h1 {
		max-width: 18ch;
	}

	.head__lead {
		color: var(--fg-muted);
		max-width: 52ch;
	}
</style>
