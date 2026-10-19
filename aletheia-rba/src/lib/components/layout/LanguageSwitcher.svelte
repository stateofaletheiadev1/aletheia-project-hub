<script lang="ts">
	import { page } from '$app/state';
	import { availableLocales, localePath } from '$lib/i18n/locales';

	/** Renders only when the site is published in more than one language. */
	const locales = availableLocales();
	const current = $derived(
		locales.find(
			(l) => page.url.pathname.startsWith(`/${l.code}/`) || page.url.pathname === `/${l.code}`
		)?.code ?? 'en'
	);
</script>

{#if locales.length > 1}
	<nav aria-label="Language" class="langs">
		<ul role="list">
			{#each locales as l (l.code)}
				<li>
					<a
						href={localePath(page.url.pathname, l.code)}
						hreflang={l.code}
						lang={l.code}
						aria-current={l.code === current ? 'true' : undefined}>{l.name}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.langs ul {
		display: flex;
		gap: var(--space-3);
		margin: 0;
	}

	.langs a {
		font-size: var(--fs-fine);
		font-weight: 600;
		color: var(--fg-muted);
		text-decoration: none;
		padding-block: var(--space-2);
	}

	.langs a[aria-current='true'] {
		color: var(--fg);
	}
</style>
