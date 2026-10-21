<script lang="ts">
	import Prose from '$lib/components/editorial/Prose.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import { longDate } from '$lib/components/publications/format';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { CONTACT } from '$lib/content';

	const REVIEWED = '2026-10-19';
</script>

<Seo
	title="Accessibility"
	description="Accessibility statement for rba.aletheiagov.org, which aims to meet WCAG 2.2 at level AA."
	path="/accessibility"
/>

<PageHead
	trail={[{ href: '/accessibility', label: 'Accessibility' }]}
	eyebrow="Legal"
	title="Accessibility."
	seed={61}
>
	{#snippet lead()}
		<p>Last reviewed <time datetime={REVIEWED}>{longDate(REVIEWED)}</time>.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment">
	<div class="container">
		<Prose>
			<p class="t-lead">
				This website aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.
			</p>
			<ul>
				<li>Every function can be used with a keyboard.</li>
				<li>Status is shown in words, never by colour alone.</li>
				<li>Animation stops when your device asks for reduced motion.</li>
				<li>Pages can be read without JavaScript.</li>
				<li>Each banknote image has a text description.</li>
			</ul>
			{#if CONTACT.email}
				<p>
					To report a barrier, write to <a href="mailto:{CONTACT.email}">{CONTACT.email}</a>.
				</p>
			{/if}
		</Prose>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/privacy', label: 'Privacy' },
		{ href: '/terms', label: 'Terms of use' }
	]}
/>
