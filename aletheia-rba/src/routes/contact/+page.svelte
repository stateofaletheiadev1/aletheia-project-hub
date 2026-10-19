<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import EmptyState from '$lib/components/institutional/EmptyState.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Link from '$lib/components/primitives/Link.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { CONTACT, SITE } from '$lib/content';

	const hasChannels = CONTACT.email !== null || CONTACT.postal !== null;
</script>

<Seo
	title="Contact"
	description="How to contact the Reserve Bank of Aletheia. Official enquiry channels are being established."
	path="/contact"
/>

<PageHead
	trail={[{ href: '/contact', label: 'Contact' }]}
	folio="§ 13"
	eyebrow="Contact"
	title="Contacting the Bank."
	seed={47}
/>

<section class="section surface-parchment">
	<div class="container contact">
		{#if hasChannels}
			<dl class="channels">
				{#if CONTACT.email}
					<div>
						<dt class="t-meta">Email</dt>
						<dd><a href="mailto:{CONTACT.email}">{CONTACT.email}</a></dd>
					</div>
				{/if}
				{#if CONTACT.postal}
					<div>
						<dt class="t-meta">Post</dt>
						<dd class="postal">{CONTACT.postal}</dd>
					</div>
				{/if}
			</dl>
			<p class="measure">{CONTACT.enquiryNote}</p>
		{:else}
			<EmptyState title="Official channels are being established" headingLevel={2} seed={47}>
				<p>{CONTACT.enquiryNote}</p>
				{#snippet actions()}
					<Link href={SITE.stateUrl}>State of Aletheia</Link>
				{/snippet}
			</EmptyState>
		{/if}
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/faq', label: 'Questions and answers' },
		{ href: '/about', label: 'About the Bank' }
	]}
/>

<style>
	.contact {
		max-width: 56rem;
	}

	.channels {
		display: grid;
		gap: var(--space-5);
		margin: 0 0 var(--space-6);
	}

	.channels dd {
		margin: var(--space-1) 0 0;
		font-size: var(--fs-lead);
	}

	.postal {
		white-space: pre-line;
	}
</style>
