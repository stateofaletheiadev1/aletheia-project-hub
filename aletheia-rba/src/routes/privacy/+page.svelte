<script lang="ts">
	import Prose from '$lib/components/editorial/Prose.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';

	const UPDATED = '2026-10-19';
</script>

<Seo
	title="Privacy"
	description="How rbaletheia.org handles personal data: no cookies, no analytics, no forms. The only processing is the hosting provider's server logs."
	path="/privacy"
/>

<PageHead
	trail={[{ href: '/privacy', label: 'Privacy' }]}
	eyebrow="Legal"
	title="Privacy."
	seed={53}
>
	{#snippet lead()}
		<p>Last updated <time datetime={UPDATED}>{longDate(UPDATED)}</time>.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment">
	<div class="container">
		<Prose>
			<p class="t-lead">
				This website does not use cookies, does not run analytics or tracking, and has no forms or
				accounts. It does not ask you for any personal information.
			</p>

			<p>
				The website’s host keeps standard server logs to deliver the site and keep it secure. If the
				site ever collects personal information, this page will be updated first.
			</p>
		</Prose>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/terms', label: 'Terms of use' },
		{ href: '/accessibility', label: 'Accessibility' }
	]}
/>
