<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import type { Artwork } from '$lib/content/banknote-artwork';
	import { Spring } from 'svelte/motion';
	import Guilloche from '../motion/Guilloche.svelte';

	/**
	 * A banknote as the hero object: soft shadow, a slight perspective, one sheen sweep on reveal
	 * and, on fine pointers only, a gentle tilt that follows the pointer (never more than 6°).
	 * Static under reduced motion; flat on small screens.
	 */
	let {
		art,
		alt,
		caption,
		eager = false,
		seed = 7
	}: { art: Artwork; alt: string; caption?: string; eager?: boolean; seed?: number } = $props();

	const MAX = 6;
	const tilt = new Spring({ x: 0, y: 0 }, { stiffness: 0.06, damping: 0.5 });
	let stage = $state<HTMLElement>();
	let frame = 0;

	$effect(() => {
		const el = stage;
		if (!el) return;
		const fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		if (!fine.matches || reduced.matches) return;

		const onMove = (e: PointerEvent) => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				const r = el.getBoundingClientRect();
				const px = (e.clientX - r.left) / r.width - 0.5;
				const py = (e.clientY - r.top) / r.height - 0.5;
				tilt.target = {
					x: Math.max(-1, Math.min(1, px * 2)),
					y: Math.max(-1, Math.min(1, py * 2))
				};
			});
		};
		const onLeave = () => (tilt.target = { x: 0, y: 0 });
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerleave', onLeave);
		return () => {
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerleave', onLeave);
			if (frame) cancelAnimationFrame(frame);
		};
	});

	// Resting pose plus pointer offset, clamped to ±6°.
	const ry = $derived(Math.max(-MAX, Math.min(MAX, -4 + tilt.current.x * 3)));
	const rx = $derived(Math.max(-MAX, Math.min(MAX, 2.5 - tilt.current.y * 3)));
</script>

<figure class="stage" bind:this={stage}>
	<div class="rosette" aria-hidden="true">
		<Guilloche kind="rosette" {seed} size={560} layers={4} draw strokeWidth={0.7} />
	</div>
	<div class="note" data-reveal use:reveal style:--rx="{rx}deg" style:--ry="{ry}deg">
		<div class="note__face" style:aspect-ratio="{art.width} / {art.height}">
			<enhanced:img
				src={art.picture}
				{alt}
				sizes="(min-width: 1024px) 40vw, 92vw"
				loading={eager ? 'eager' : 'lazy'}
				fetchpriority={eager ? 'high' : undefined}
			/>
			<span class="sheen" aria-hidden="true"></span>
		</div>
	</div>
	{#if caption}<figcaption class="t-fine">{caption}</figcaption>{/if}
</figure>

<style>
	.stage {
		position: relative;
		display: grid;
		gap: var(--space-4);
		perspective: 1400px;
	}

	.rosette {
		position: absolute;
		inset: 50% auto auto 50%;
		width: 118%;
		transform: translate(-50%, -54%);
		opacity: 0.55;
		pointer-events: none;
	}

	.note {
		position: relative;
		transform-style: preserve-3d;
		transform: rotateX(var(--rx, 2.5deg)) rotateY(var(--ry, -4deg));
	}

	.note__face {
		position: relative;
		overflow: hidden;
		box-shadow:
			0 2px 2px rgb(5 12 24 / 0.25),
			0 30px 60px -24px rgb(5 12 24 / 0.65);
	}

	.note__face :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/* One sweep of light across the note when it is revealed. */
	.sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			transparent 35%,
			rgb(255 255 255 / 0.32) 48%,
			rgb(255 255 255 / 0.06) 56%,
			transparent 64%
		);
		transform: translateX(-120%);
		pointer-events: none;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.js) .note:not(:global(.is-revealed)) {
			opacity: 0;
			transform: translateY(8px) rotateX(var(--rx, 2.5deg)) rotateY(var(--ry, -4deg));
		}

		.note {
			transition:
				opacity 900ms var(--ease-out-quart),
				transform 900ms var(--ease-out-quart);
		}

		:global(.is-revealed) .sheen {
			animation: sheen 1200ms var(--ease-ceremonial) 700ms 1 both;
		}
	}

	@keyframes sheen {
		from {
			transform: translateX(-120%);
		}
		to {
			transform: translateX(120%);
		}
	}

	figcaption {
		position: relative;
		color: var(--fg-muted);
		border-top: var(--hairline) solid var(--line);
		padding-top: var(--space-2);
	}

	/* Small screens: flat and full width, no pointer effects. */
	@media (max-width: 1023px) {
		.note {
			transform: none !important;
		}

		.rosette {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.note {
			transform: rotateX(2.5deg) rotateY(-4deg);
		}
	}
</style>
