<script lang="ts">
	import { breadcrumbList, type Crumb } from '$lib/seo/jsonld';
	import JsonLd from '../seo/JsonLd.svelte';

	/** The trail after Home; the last crumb is the current page. Emits BreadcrumbList JSON-LD. */
	let { trail }: { trail: Crumb[] } = $props();

	const crumbs = $derived([{ href: '/', label: 'Home' }, ...trail]);
</script>

<nav aria-label="Breadcrumb" class="crumbs">
	<ol role="list">
		{#each crumbs as crumb, i (crumb.href)}
			<li>
				{#if i === crumbs.length - 1}
					<a href={crumb.href} aria-current="page">{crumb.label}</a>
				{:else}
					<a href={crumb.href}>{crumb.label}</a>
					<span class="sep" aria-hidden="true">/</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<JsonLd data={breadcrumbList(crumbs)} />

<style>
	.crumbs ol {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		margin: 0;
		font-size: var(--fs-meta);
		letter-spacing: 0.02em;
	}

	.crumbs li {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.crumbs a {
		color: var(--fg-muted);
		text-decoration: none;
		padding-block: var(--space-2);
	}

	.crumbs a:hover {
		color: var(--fg);
		text-decoration: underline;
	}

	.crumbs a[aria-current='page'] {
		color: var(--fg);
	}

	.sep {
		color: var(--line-strong);
	}
</style>
