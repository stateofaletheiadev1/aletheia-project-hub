<script lang="ts">
	import { page } from '$app/state';
	import Eyebrow from '$lib/components/editorial/Eyebrow.svelte';
	import Guilloche from '$lib/components/motion/Guilloche.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';

	const notFound = $derived(page.status === 404);

	const suggestions = [
		{ href: '/', label: 'Home', note: 'The Reserve Bank of Aletheia' },
		{ href: '/about', label: 'About the Bank', note: 'Purpose and mandate' },
		{ href: '/currency', label: 'The Aletheian Guilder', note: 'The currency of Aletheia' },
		{ href: '/banknotes', label: 'Banknote designs', note: 'Five denominations' },
		{ href: '/publications', label: 'Publications', note: 'Documents of the Bank' },
		{ href: '/faq', label: 'Questions and answers', note: 'Common questions' }
	];
</script>

<Seo
	title={notFound ? 'Page not found' : 'Something went wrong'}
	description="This page could not be shown."
	path={page.url.pathname}
	noindex
/>

<section class="error surface-navy">
	<div class="ornament" aria-hidden="true">
		<Guilloche kind="rosette" seed={404} size={520} layers={4} />
	</div>
	<div class="container error__inner">
		<Eyebrow folio={`§ ${page.status}`}>{notFound ? 'Not found' : 'Error'}</Eyebrow>
		<h1 class="t-h1">
			{notFound ? 'There is no page at this address.' : 'This page could not be shown.'}
		</h1>
		<p class="t-lead lead">
			{#if notFound}
				It may have moved, or the address may be mistyped. Documents published by the Bank keep
				their addresses permanently.
			{:else}
				Please try again in a moment.
			{/if}
		</p>
	</div>
</section>

<section class="surface-parchment section--tight">
	<div class="container">
		<h2 class="t-meta suggest__heading">Places to continue</h2>
		<ul role="list" class="suggest">
			{#each suggestions as s (s.href)}
				<li>
					<a href={s.href}>
						<span class="suggest__label">{s.label}</span>
						<span class="suggest__note">{s.note}</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.error {
		position: relative;
		overflow: hidden;
		padding-top: calc(var(--masthead-h) + var(--space-9));
		padding-bottom: var(--space-9);
	}

	.ornament {
		position: absolute;
		right: -8rem;
		top: 50%;
		width: min(36rem, 80vw);
		transform: translateY(-40%);
		opacity: 0.35;
	}

	.error__inner {
		position: relative;
		display: grid;
		gap: var(--space-5);
	}

	.error__inner h1 {
		max-width: 16ch;
	}

	.lead {
		color: var(--fg-muted);
		max-width: 48ch;
	}

	.suggest__heading {
		color: var(--fg-muted);
		margin-bottom: var(--space-4);
	}

	.suggest {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		border-top: var(--hairline) solid var(--line-strong);
		margin: 0;
	}

	.suggest a {
		display: grid;
		gap: 2px;
		padding: var(--space-4) var(--space-4) var(--space-4) 0;
		border-bottom: var(--hairline) solid var(--line);
		text-decoration: none;
	}

	.suggest__label {
		font-weight: 650;
	}

	.suggest__note {
		color: var(--fg-muted);
		font-size: var(--fs-meta);
	}

	.suggest a:hover .suggest__label {
		text-decoration: underline;
	}
</style>
