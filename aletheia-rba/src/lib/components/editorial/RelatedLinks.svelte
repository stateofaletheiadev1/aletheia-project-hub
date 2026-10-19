<script lang="ts">
	import Icon from '../primitives/Icon.svelte';

	/** Contextual "Related" links that close every page. */
	let {
		links,
		heading = 'Related'
	}: { links: { href: string; label: string; note?: string }[]; heading?: string } = $props();
</script>

<section class="related surface-parchment" aria-labelledby="related-heading">
	<div class="container related__inner">
		<h2 id="related-heading" class="t-meta related__heading">{heading}</h2>
		<ul role="list" class="related__list">
			{#each links as link (link.href)}
				<li>
					<a href={link.href}>
						<span class="related__label">{link.label}</span>
						{#if link.note}<span class="related__note">{link.note}</span>{/if}
						<Icon name="arrow-right" size={18} class="nudge related__arrow" />
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.related {
		padding-block: var(--space-8);
		border-top: var(--hairline) solid var(--line-strong);
	}

	.related__inner {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1024px) {
		.related__inner {
			grid-template-columns: 3fr 9fr;
		}
	}

	.related__heading {
		color: var(--fg-muted);
		padding-top: var(--space-4);
	}

	.related__list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		margin: 0;
		column-gap: var(--gutter);
	}

	.related__list a {
		position: relative;
		display: grid;
		gap: 2px;
		padding: var(--space-4) var(--space-7) var(--space-4) 0;
		border-top: var(--hairline) solid var(--line-strong);
		text-decoration: none;
		min-height: 100%;
	}

	.related__label {
		font-size: var(--fs-h4);
		font-weight: 600;
	}

	.related__note {
		color: var(--fg-muted);
		font-size: var(--fs-meta);
	}

	.related__list :global(.related__arrow) {
		position: absolute;
		right: 0;
		top: var(--space-4);
	}

	.related__list a:hover .related__label {
		text-decoration: underline;
		text-decoration-color: var(--line-strong);
	}
</style>
