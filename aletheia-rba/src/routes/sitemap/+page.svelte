<script lang="ts">
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { FOOTER_NAV, isGroup, LEGAL_NAV, PRIMARY_NAV, UTILITY_NAV } from '$lib/content';

	/** Built from the navigation itself, so the sitemap cannot fall out of step with the site. */
	const groups = [
		...PRIMARY_NAV.map((item) =>
			isGroup(item)
				? { heading: item.label, links: item.children }
				: { heading: item.label, links: [item] }
		),
		{ heading: 'Information', links: [...UTILITY_NAV, ...(FOOTER_NAV.at(-1)?.links ?? [])] },
		{ heading: 'Legal', links: LEGAL_NAV }
	].map((g) => ({
		...g,
		links: g.links.filter((l, i, all) => all.findIndex((x) => x.href === l.href) === i)
	}));
</script>

<Seo
	title="Sitemap"
	description="Every page of the Reserve Bank of Aletheia website."
	path="/sitemap"
/>

<PageHead
	trail={[{ href: '/sitemap', label: 'Sitemap' }]}
	eyebrow="Sitemap"
	title="Sitemap."
	seed={137}
/>

<section class="section surface-parchment">
	<div class="container">
		<div class="groups">
			{#each groups as g (g.heading)}
				<section class="group" aria-labelledby="sm-{g.heading.replace(/\W+/g, '-')}">
					<h2 id="sm-{g.heading.replace(/\W+/g, '-')}" class="t-meta">{g.heading}</h2>
					<ul role="list">
						{#each g.links as l (l.href)}
							<li><a href={l.href}>{l.label}</a></li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</div>
</section>

<style>
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--space-7) var(--gutter);
	}

	.group {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding-top: var(--space-4);
		border-top: 2px solid var(--fg);
	}

	.group h2 {
		color: var(--fg-muted);
	}

	.group ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
	}

	.group a {
		display: inline-block;
		padding-block: var(--space-2);
		font-weight: 550;
	}
</style>
