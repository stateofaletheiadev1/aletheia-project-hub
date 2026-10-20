<script lang="ts">
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { banknotes } from '$lib/content';
	import { artworkFor } from '$lib/content/banknote-artwork';

	const themes = [
		{
			title: 'Faith and learning',
			notes: [1, 20],
			body: 'St Benedict of Nursia and St Augustine of Hippo: the rule of life and the city of the mind.'
		},
		{
			title: 'Discovery',
			notes: [5],
			body: 'Nikola Tesla and the energy of the sea: wind, light and invention.'
		},
		{
			title: 'The public record',
			notes: [10],
			body: 'An open ledger and the plan of a city: a nation that keeps its accounts in the open.'
		},
		{
			title: 'The sea and the states',
			notes: [100],
			body: 'St Brendan the Navigator, and the emblems of the four founding states.'
		}
	];

	const noteFor = (d: number) => banknotes.find((b) => b.denomination === d);
</script>

<Seo
	title="Banknote Design Themes"
	description="The themes of the Aletheian Guilder banknote series: faith and learning, discovery, the public record, and the sea."
	path="/banknotes/design"
	ogImage="/og/banknotes.png"
/>

<PageHead
	trail={[
		{ href: '/currency', label: 'The Guilder' },
		{ href: '/banknotes', label: 'Banknotes' },
		{ href: '/banknotes/design', label: 'Design themes' }
	]}
	folio="§ 07.3"
	eyebrow="Banknote design"
	title="The story of the series."
	seed={179}
>
	{#snippet lead()}
		<p>Five notes, four themes, drawn from the character of the nation.</p>
	{/snippet}
</PageHead>

<section class="section surface-parchment" aria-labelledby="themes-title">
	<div class="container">
		<SectionHeader
			folio="§ 07.3.1"
			eyebrow="Themes"
			title="What the notes show"
			id="themes-title"
		/>
		<ol role="list" class="themes">
			{#each themes as t (t.title)}
				<li class="theme">
					<div class="thumbs">
						{#each t.notes as d (d)}
							{@const note = noteFor(d)}
							{#if note}
								{@const art = artworkFor(note.front.src)}
								<a
									href="/banknotes#aey-{d}"
									aria-label="{d} AEY in the banknote series"
									style:aspect-ratio="{art.width} / {art.height}"
								>
									<enhanced:img
										src={art.picture}
										alt=""
										sizes="(min-width: 1024px) 22vw, 80vw"
										loading="lazy"
									/>
								</a>
							{/if}
						{/each}
					</div>
					<div class="theme__text">
						<p class="t-meta">{t.notes.map((d) => `${d} AEY`).join(' · ')}</p>
						<h3 class="t-h3">{t.title}</h3>
						<p>{t.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="section surface-raised" aria-labelledby="craft-title">
	<div class="container split">
		<SectionHeader
			folio="§ 07.3.2"
			eyebrow="Craft"
			title="An engraved tradition"
			id="craft-title"
		/>
		<p class="t-lead measure">
			The series is drawn in the manner of engraved notes: fine linework, guilloché borders and
			portraits in line. Each denomination has its own colour, so it can be told apart at a glance.
		</p>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/banknotes', label: 'Banknote designs' },
		{ href: '/banknotes/reproduction', label: 'Using banknote images' }
	]}
/>

<style>
	.themes {
		display: grid;
		margin: 0;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.theme {
		display: grid;
		gap: var(--space-5) var(--gutter);
		padding-block: var(--space-7);
		border-bottom: var(--hairline) solid var(--line);
		align-items: center;
	}

	@media (min-width: 900px) {
		.theme {
			grid-template-columns: 6fr 6fr;
		}
	}

	.thumbs {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}

	.thumbs a {
		display: block;
		overflow: hidden;
		box-shadow: 0 14px 28px -18px rgb(13 26 48 / 0.45);
	}

	.thumbs :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.theme__text {
		display: grid;
		gap: var(--space-3);
	}

	.theme__text .t-meta {
		color: var(--fg-accent);
	}

	.theme__text p:last-child {
		color: var(--fg-muted);
		max-width: 48ch;
	}

	.split {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 1024px) {
		.split {
			grid-template-columns: 5fr 7fr;
			gap: var(--gutter);
		}
	}
</style>
