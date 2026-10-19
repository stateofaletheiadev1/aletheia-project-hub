<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import { artworkFor } from '$lib/content/banknote-artwork';
	import type { Banknote } from '$lib/content/schema';

	/** The five designs as a row at true aspect ratio; a scroll-snap row on narrow screens. */
	let { notes, side = 'front' }: { notes: Banknote[]; side?: 'front' | 'back' } = $props();
</script>

<ul role="list" class="strip">
	{#each notes as note, i (note.denomination)}
		{@const face = side === 'back' && note.back ? note.back : note.front}
		{@const art = artworkFor(face.src)}
		<li data-reveal use:reveal={i}>
			<a href="/banknotes#aey-{note.denomination}" class="note">
				<span class="frame" style:aspect-ratio="{art.width} / {art.height}">
					<enhanced:img
						src={art.picture}
						alt={face.alt}
						sizes="(min-width: 1024px) 18vw, (min-width: 600px) 40vw, 72vw"
						loading="lazy"
					/>
				</span>
				<span class="caption">
					<span class="denom num">{note.denomination}</span>
					<span class="code">AEY</span>
					<span class="colour">{note.dominantColour}</span>
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 72%;
		gap: var(--gutter);
		margin: 0;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--gutter);
		padding-bottom: var(--space-4);
		overscroll-behavior-x: contain;
	}

	@media (min-width: 600px) {
		.strip {
			grid-auto-columns: 40%;
		}
	}

	@media (min-width: 1024px) {
		.strip {
			grid-auto-flow: row;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			overflow: visible;
			padding-bottom: 0;
		}
	}

	.strip li {
		scroll-snap-align: start;
	}

	.note {
		display: grid;
		gap: var(--space-3);
		text-decoration: none;
	}

	.frame {
		display: block;
		overflow: hidden;
		background: var(--c-parchment-200);
		box-shadow:
			0 1px 0 var(--rule),
			0 14px 28px -18px rgb(13 26 48 / 0.45);
		transition: transform var(--dur-2) var(--ease-out-quart);
	}

	.frame :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.note:hover .frame {
		transform: translateY(-3px);
	}

	.caption {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		border-top: var(--hairline) solid var(--line);
		padding-top: var(--space-2);
	}

	.denom {
		font-size: var(--fs-h3);
		font-weight: 350;
	}

	.code {
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
	}

	.colour {
		margin-left: auto;
		font-size: var(--fs-fine);
		color: var(--fg-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.note:hover .frame {
			transform: none;
		}
	}
</style>
