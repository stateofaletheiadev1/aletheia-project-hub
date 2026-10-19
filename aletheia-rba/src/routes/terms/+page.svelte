<script lang="ts">
	import Prose from '$lib/components/editorial/Prose.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { SITE } from '$lib/content';

	const UPDATED = '2026-10-19';
</script>

<Seo
	title="Terms of Use"
	description="Terms of use for rbaletheia.org: an informational website that offers no financial products and is not a basis for financial decisions."
	path="/terms"
/>

<PageHead
	trail={[{ href: '/terms', label: 'Terms of use' }]}
	eyebrow="Legal"
	title="Terms of use."
	seed={59}
>
	{#snippet lead()}
		<p>Last updated <time datetime={UPDATED}>{longDate(UPDATED)}</time>.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment">
	<div class="container">
		<Prose>
			<h2>An informational website</h2>
			<p>
				This website describes the {SITE.name} and the Aletheian Guilder.
			</p>

			<h2>No financial products or offers</h2>
			<p>
				Nothing on this website is an offer to issue, sell, buy, exchange or redeem the Aletheian
				Guilder or anything else, or an invitation to do so. The website offers no accounts,
				payments, investments or financial services.
			</p>

			<h2>No reliance</h2>
			<p>
				The content is published for information. It is not financial, legal or investment advice,
				and should not be relied on in making any financial decision. Intentions described here may
				change, and statuses are correct as of the dates shown.
			</p>

			<h2>The banknote designs</h2>
			<p>
				The banknote designs are published as specimens. They must not be reproduced in a way that
				could be mistaken for currency, or presented as notes that have been issued.
			</p>

			<h2>Intellectual property</h2>
			<p>
				The text, the banknote designs, the coat of arms and the other material on this website
				belong to the {SITE.state} unless stated otherwise. The Manrope typeface is used under the SIL
				Open Font License.
			</p>

			<h2>Other websites</h2>
			<p>
				Links to other websites are provided for convenience. The Bank is not responsible for their
				content.
			</p>

			<h2>Changes</h2>
			<p>These terms may be updated. The date above shows when they last changed.</p>
		</Prose>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/privacy', label: 'Privacy' },
		{ href: '/accessibility', label: 'Accessibility' }
	]}
/>
