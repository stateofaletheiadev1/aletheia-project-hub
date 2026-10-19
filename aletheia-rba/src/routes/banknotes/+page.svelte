<script lang="ts">
	import BanknoteDialog, { type ViewerNote } from '$lib/components/currency/BanknoteDialog.svelte';
	import RelatedLinks from '$lib/components/editorial/RelatedLinks.svelte';
	import SectionHeader from '$lib/components/editorial/SectionHeader.svelte';
	import PageHead from '$lib/components/layout/PageHead.svelte';
	import Icon from '$lib/components/primitives/Icon.svelte';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { banknotes } from '$lib/content';
	import { artworkFor } from '$lib/content/banknote-artwork';
	import { imageObject } from '$lib/seo/jsonld';

	const viewerNotes: ViewerNote[] = banknotes.map((b) => ({
		denomination: b.denomination,
		front: { art: artworkFor(b.front.src), alt: b.front.alt },
		back: b.back ? { art: artworkFor(b.back.src), alt: b.back.alt } : null
	}));

	let viewer = $state<ReturnType<typeof BanknoteDialog>>();
	let selected = $state(banknotes.length - 1);
	let side = $state<'front' | 'back'>('front');
	let radios: HTMLButtonElement[] = $state([]);

	const featured = $derived(banknotes[selected]);
	const featuredView = $derived(viewerNotes[selected]);

	function choose(i: number, focus = false) {
		selected = i;
		side = 'front';
		if (focus) radios[i]?.focus();
	}

	function onRadioKey(e: KeyboardEvent, i: number) {
		const keys: Record<string, number> = {
			ArrowRight: 1,
			ArrowDown: 1,
			ArrowLeft: -1,
			ArrowUp: -1
		};
		if (e.key in keys) {
			e.preventDefault();
			choose((i + (keys[e.key] ?? 0) + banknotes.length) % banknotes.length, true);
		} else if (e.key === 'Home') {
			e.preventDefault();
			choose(0, true);
		} else if (e.key === 'End') {
			e.preventDefault();
			choose(banknotes.length - 1, true);
		}
	}

	function openViewer(e: MouseEvent, i: number, s: 'front' | 'back') {
		// Without JS the link opens the full-size image instead.
		e.preventDefault();
		viewer?.open(i, s);
	}

	const jsonLd = viewerNotes.flatMap((n) =>
		[n.front, n.back]
			.filter((f) => f !== null)
			.map((f) =>
				imageObject({
					url: f.art.original,
					name: `${n.denomination} AEY banknote design (specimen)`,
					caption: f.alt
				})
			)
	);
</script>

<Seo
	title="Banknote Designs · Aletheian Guilder"
	description="The banknote designs of the Aletheian Guilder, in five denominations from 1 to 100 AEY."
	path="/banknotes"
	ogImage="/og/banknotes.png"
	ogImageAlt="Aletheian Guilder banknote designs"
/>
<JsonLd data={jsonLd} />

<PageHead
	trail={[
		{ href: '/currency', label: 'The Guilder' },
		{ href: '/banknotes', label: 'Banknotes' }
	]}
	folio="§ 07"
	eyebrow="Banknotes"
	title="Banknote designs."
	seed={13}
>
	{#snippet lead()}
		<p>The banknote series of the Aletheian Guilder: five denominations, from 1 to 100 AEY.</p>
	{/snippet}
</PageHead>

<section class="section surface-navy stage-section" aria-labelledby="stage-title">
	<div class="container stage">
		<div class="stage__controls">
			<h2 id="stage-title" class="t-meta stage__label">Denomination</h2>
			<div class="radios js-only" role="radiogroup" aria-labelledby="stage-title">
				{#each banknotes as b, i (b.denomination)}
					<button
						bind:this={radios[i]}
						type="button"
						role="radio"
						aria-checked={selected === i}
						tabindex={selected === i ? 0 : -1}
						onclick={() => choose(i)}
						onkeydown={(e) => onRadioKey(e, i)}
					>
						<span class="num">{b.denomination}</span>
					</button>
				{/each}
			</div>
			<p class="nojs-only t-fine">All five designs are shown below.</p>

			{#if featured}
				<div class="stage__meta">
					<p class="stage__denom">
						<span class="num">{featured.denomination}</span> <span class="code">AEY</span>
					</p>
					<p class="stage__words">{featured.words}</p>
					<p class="t-fine">{featured.dominantColour}</p>
				</div>
				<div class="stage__actions js-only">
					<button
						type="button"
						class="stage__btn"
						aria-pressed={side === 'back'}
						disabled={!featured.back}
						onclick={() => (side = side === 'front' ? 'back' : 'front')}
					>
						<Icon name="flip" />
						<span>Show back</span>
					</button>
					<button type="button" class="stage__btn" onclick={(e) => openViewer(e, selected, side)}>
						<Icon name="zoom-in" />
						<span>View larger</span>
					</button>
				</div>
			{/if}
		</div>

		{#if featuredView}
			<div class="stage__note">
				{#key selected}
					<div class="card" class:flipped={side === 'back'}>
						<div
							class="card__face card__front"
							style:aspect-ratio="{featuredView.front.art.width} / {featuredView.front.art.height}"
							aria-hidden={side === 'back'}
						>
							<enhanced:img
								src={featuredView.front.art.picture}
								alt={featuredView.front.alt}
								sizes="(min-width: 1024px) 55vw, 92vw"
								fetchpriority="high"
							/>
						</div>
						{#if featuredView.back}
							<div
								class="card__face card__back"
								style:aspect-ratio="{featuredView.back.art.width} / {featuredView.back.art.height}"
								aria-hidden={side === 'front'}
							>
								<enhanced:img
									src={featuredView.back.art.picture}
									alt={featuredView.back.alt}
									sizes="(min-width: 1024px) 55vw, 92vw"
									loading="lazy"
								/>
							</div>
						{/if}
					</div>
				{/key}
			</div>
		{/if}
	</div>
</section>

<section class="section surface-parchment" aria-labelledby="series-title">
	<div class="container">
		<SectionHeader folio="§ 07.1" eyebrow="The series" title="All five designs" id="series-title">
			{#snippet intro()}
				<p>Shown at their true proportions. Select an image to view it larger.</p>
			{/snippet}
		</SectionHeader>

		<ol role="list" class="series">
			{#each banknotes as b, i (b.denomination)}
				{@const view = viewerNotes[i]}
				{#if view}
					<li id="aey-{b.denomination}" class="entry">
						<header class="entry__head">
							<h3 class="entry__title">
								<span class="num">{b.denomination}</span> <span class="code">AEY</span>
							</h3>
							<p class="t-muted">{b.words}</p>
						</header>

						<div class="entry__faces">
							{#each [{ s: 'front' as const, f: view.front }, ...(view.back ? [{ s: 'back' as const, f: view.back }] : [])] as item (item.s)}
								<figure class="face">
									<a
										href={item.f.art.original}
										class="face__link"
										style:aspect-ratio="{item.f.art.width} / {item.f.art.height}"
										onclick={(e) => openViewer(e, i, item.s)}
									>
										<enhanced:img
											src={item.f.art.picture}
											alt={item.f.alt}
											sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
											loading="lazy"
										/>
										<span class="face__zoom" aria-hidden="true"
											><Icon name="zoom-in" size={18} /></span
										>
									</a>
									<figcaption class="t-fine">{item.s === 'front' ? 'Front' : 'Back'}</figcaption>
								</figure>
							{/each}
						</div>

						<dl class="entry__facts">
							<div>
								<dt>Colour</dt>
								<dd>{b.dominantColour ?? 'Not recorded'}</dd>
							</div>
						</dl>

						<div class="entry__notes">
							<h4 class="t-meta">Design</h4>
							<ul>
								{#each b.designNotes as note (note)}<li>{note}</li>{/each}
							</ul>
						</div>
						
					</li>
				{/if}
			{/each}
		</ol>
	</div>
</section>

<RelatedLinks
	links={[
		{ href: '/currency', label: 'The Aletheian Guilder' },
		{ href: '/issuance', label: 'Issuance' },
		{ href: '/faq', label: 'Questions and answers' }
	]}
/>

<BanknoteDialog bind:this={viewer} notes={viewerNotes} />

<style>
	.stage {
		display: grid;
		gap: var(--space-7);
		align-items: center;
	}

	@media (min-width: 1024px) {
		.stage {
			grid-template-columns: 4fr 8fr;
			gap: var(--gutter);
		}
	}

	.stage__controls {
		display: grid;
		gap: var(--space-5);
		align-content: center;
	}

	.stage__label {
		color: var(--fg-muted);
	}

	.radios {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.radios button {
		min-width: 3.25rem;
		min-height: 44px;
		padding-inline: var(--space-3);
		border: var(--hairline) solid var(--line-strong);
		border-radius: var(--radius-control);
		font-size: var(--fs-lead);
		font-weight: 450;
		transition:
			background-color var(--dur-1) var(--ease-out-quart),
			color var(--dur-1) var(--ease-out-quart);
	}

	.radios button:hover {
		border-color: var(--fg);
	}

	.radios button[aria-checked='true'] {
		background: var(--c-parchment);
		color: var(--c-navy);
		border-color: var(--c-parchment);
	}

	.stage__meta {
		display: grid;
		gap: var(--space-1);
		padding-top: var(--space-4);
		border-top: var(--hairline) solid var(--line);
	}

	.stage__denom {
		font-size: var(--fs-h1);
		font-weight: 250;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.code {
		font-size: 0.35em;
		font-weight: 650;
		letter-spacing: var(--track-meta);
		vertical-align: 0.9em;
	}

	.stage__words {
		font-size: var(--fs-lead);
	}

	.stage__meta .t-fine {
		color: var(--fg-muted);
	}

	.stage__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.stage__btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-2) var(--space-4);
		border: var(--hairline) solid var(--line-strong);
		border-radius: var(--radius-control);
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
	}

	.stage__btn:hover:not(:disabled) {
		border-color: var(--fg);
	}

	.stage__btn[aria-pressed='true'] {
		color: var(--c-gold);
		border-color: var(--c-gold);
	}

	.stage__btn:disabled {
		opacity: 0.4;
	}

	.stage__note {
		perspective: 1600px;
	}

	/* Front and back as the two faces of one card; the flip is a rotation. */
	.card {
		display: grid;
		transform-style: preserve-3d;
		transition: transform var(--dur-4) var(--ease-in-out-quint);
		animation: card-in var(--dur-3) var(--ease-out-quart) both;
	}

	.card.flipped {
		transform: rotateY(180deg);
	}

	.card__face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		overflow: hidden;
		box-shadow:
			0 2px 2px rgb(5 12 24 / 0.25),
			0 30px 60px -24px rgb(5 12 24 / 0.65);
	}

	.card__face :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.card__back {
		transform: rotateY(180deg);
	}

	@keyframes card-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Reduced motion: a crossfade instead of a flip. */
	@media (prefers-reduced-motion: reduce) {
		.card,
		.card.flipped {
			transform: none;
			transition: none;
		}

		.card__back {
			transform: none;
		}

		.card__face {
			transition: opacity var(--dur-2) linear;
		}

		.card:not(.flipped) .card__back,
		.card.flipped .card__front {
			opacity: 0;
		}
	}

	.series {
		display: grid;
		margin: 0;
		border-top: 2px solid var(--fg);
	}

	.entry {
		display: grid;
		gap: var(--space-5) var(--gutter);
		padding-block: var(--space-7);
		border-bottom: var(--hairline) solid var(--line-strong);
		scroll-margin-top: calc(var(--bar-h) + var(--space-4));
	}

	@media (min-width: 1024px) {
		.entry {
			grid-template-columns: 3fr 9fr;
			grid-template-areas:
				'head faces'
				'facts faces'
				'notes notes';
			align-items: start;
		}

		.entry__head {
			grid-area: head;
		}

		.entry__faces {
			grid-area: faces;
		}

		.entry__facts {
			grid-area: facts;
		}

		.entry__notes {
			grid-column: 2;
		}
	}

	.entry__title {
		font-size: var(--fs-h1);
		font-weight: 250;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.entry__faces {
		display: grid;
		gap: var(--space-4);
	}

	@media (min-width: 640px) {
		.entry__faces {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.face {
		display: grid;
		gap: var(--space-2);
	}

	.face__link {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--c-parchment-200);
		box-shadow: 0 14px 28px -18px rgb(13 26 48 / 0.45);
		cursor: zoom-in;
	}

	.face__link :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
		transition: transform var(--dur-3) var(--ease-out-quart);
	}

	.face__link:hover :global(img) {
		transform: scale(1.02);
	}

	.face__zoom {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		background: var(--c-navy);
		color: var(--c-parchment);
		opacity: 0;
		transition: opacity var(--dur-2) var(--ease-out-quart);
	}

	.face__link:hover .face__zoom,
	.face__link:focus-visible .face__zoom {
		opacity: 1;
	}

	.entry__facts {
		display: grid;
		gap: var(--space-2);
		margin: 0;
	}

	.entry__facts div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--space-3);
		align-items: baseline;
		padding-block: var(--space-1);
		border-bottom: var(--hairline) solid var(--line);
	}

	.entry__facts dt {
		font-size: var(--fs-fine);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.entry__facts dd {
		margin: 0;
	}

	.entry__notes,
	.entry__notes h4,
	.entry__notes ul {
		display: grid;
		gap: var(--space-2);
		padding-left: 1.1em;
		max-width: var(--measure);
	}

	@media (min-width: 768px) {
	}

	@media (min-width: 1024px) {
	}
</style>
