<script lang="ts" module>
	import type { Artwork } from '$lib/content/banknote-artwork';

	export interface ViewerNote {
		denomination: number;
		front: { art: Artwork; alt: string };
		back: { art: Artwork; alt: string } | null;
	}
</script>

<script lang="ts">
	import Icon from '../primitives/Icon.svelte';

	/**
	 * Full-screen viewer in a native <dialog>. Keys: ←/→ previous/next, F front/back, +/− zoom,
	 * 0 reset, Esc close. Pointer: drag to pan when zoomed, swipe to change note when not, pinch
	 * and double-tap to zoom, Ctrl/⌘ + wheel to zoom. Only the original of the current note and its
	 * neighbours is loaded.
	 */
	let { notes }: { notes: ViewerNote[] } = $props();

	const MIN = 1;
	const MAX = 3;

	let dialog = $state<HTMLDialogElement>();
	let viewport = $state<HTMLElement>();
	let index = $state(0);
	let side = $state<'front' | 'back'>('front');
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let opener: HTMLElement | null = null;

	const note = $derived(notes[index]);
	const face = $derived(note ? (side === 'back' && note.back ? note.back : note.front) : null);
	const announcement = $derived(
		note ? `${note.denomination} AEY, ${side}. Note ${index + 1} of ${notes.length}.` : ''
	);

	export function open(i: number, s: 'front' | 'back' = 'front') {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		index = i;
		side = s;
		reset();
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function onClose() {
		opener?.focus();
	}

	function reset() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	function go(delta: number) {
		index = (index + delta + notes.length) % notes.length;
		reset();
	}

	function flip() {
		if (!note?.back) return;
		side = side === 'front' ? 'back' : 'front';
		reset();
	}

	function clampPan() {
		const el = viewport;
		if (!el) return;
		const maxX = ((scale - 1) * el.clientWidth) / 2;
		const maxY = ((scale - 1) * el.clientHeight) / 2;
		tx = Math.max(-maxX, Math.min(maxX, tx));
		ty = Math.max(-maxY, Math.min(maxY, ty));
	}

	/** Zoom towards a point given in viewport coordinates (centre if omitted). */
	function zoomTo(next: number, px?: number, py?: number) {
		const el = viewport;
		const target = Math.max(MIN, Math.min(MAX, next));
		if (el && px !== undefined && py !== undefined) {
			const r = el.getBoundingClientRect();
			const cx = px - r.left - r.width / 2;
			const cy = py - r.top - r.height / 2;
			const k = target / scale;
			tx = cx - (cx - tx) * k;
			ty = cy - (cy - ty) * k;
		}
		scale = target;
		if (scale === 1) {
			tx = 0;
			ty = 0;
		}
		clampPan();
	}

	function onKey(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				go(1);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				go(-1);
				break;
			case 'f':
			case 'F':
				e.preventDefault();
				flip();
				break;
			case '+':
			case '=':
				e.preventDefault();
				zoomTo(scale + 0.5);
				break;
			case '-':
				e.preventDefault();
				zoomTo(scale - 0.5);
				break;
			case '0':
				e.preventDefault();
				reset();
				break;
		}
	}

	function onWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey)) return;
		e.preventDefault();
		zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
	}

	// Pointer handling: pan, swipe, pinch and double-tap.
	// Plain Map on purpose: pointer positions are bookkeeping, not state the UI renders.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const pointers = new Map<number, { x: number; y: number }>();
	let start = { x: 0, y: 0, tx: 0, ty: 0 };
	let pinchStart = { dist: 0, scale: 1 };
	let lastTap = 0;

	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 1) {
			start = { x: e.clientX, y: e.clientY, tx, ty };
			const now = performance.now();
			if (now - lastTap < 300) {
				zoomTo(scale > 1 ? 1 : 2, e.clientX, e.clientY);
				lastTap = 0;
			} else {
				lastTap = now;
			}
		} else if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			if (a && b) pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			if (a && b && pinchStart.dist > 0) {
				const dist = Math.hypot(a.x - b.x, a.y - b.y);
				zoomTo(pinchStart.scale * (dist / pinchStart.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
			}
		} else if (pointers.size === 1 && scale > 1) {
			tx = start.tx + (e.clientX - start.x);
			ty = start.ty + (e.clientY - start.y);
			clampPan();
		}
	}

	function onPointerUp(e: PointerEvent) {
		const wasSingle = pointers.size === 1;
		pointers.delete(e.pointerId);
		if (wasSingle && scale === 1) {
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
		}
	}

	// Preload the neighbours' originals for the current side, nothing more.
	$effect(() => {
		if (!dialog?.open || notes.length < 2) return;
		for (const d of [-1, 1]) {
			const n = notes[(index + d + notes.length) % notes.length];
			const f = n && (side === 'back' && n.back ? n.back : n.front);
			if (f) {
				const img = new Image();
				img.src = f.art.original;
			}
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="viewer"
	aria-label="Banknote viewer"
	onclose={onClose}
	onkeydown={onKey}
>
	{#if note && face}
		<div class="viewer__bar">
			<p class="viewer__title">
				<span class="num">{note.denomination}</span> AEY
				<span class="t-meta viewer__side">{side}</span>
			</p>
			<div class="viewer__tools" role="toolbar" aria-label="Viewer controls">
				<button type="button" onclick={() => go(-1)} aria-label="Previous note">
					<Icon name="chevron-left" />
				</button>
				<button type="button" onclick={() => go(1)} aria-label="Next note">
					<Icon name="chevron-right" />
				</button>
				<button
					type="button"
					onclick={flip}
					aria-pressed={side === 'back'}
					disabled={!note.back}
					aria-label="Show back (F)"
				>
					<Icon name="flip" />
				</button>
				<button
					type="button"
					onclick={() => zoomTo(scale - 0.5)}
					disabled={scale <= MIN}
					aria-label="Zoom out"
				>
					<Icon name="zoom-out" />
				</button>
				<button
					type="button"
					onclick={() => zoomTo(scale + 0.5)}
					disabled={scale >= MAX}
					aria-label="Zoom in"
				>
					<Icon name="zoom-in" />
				</button>
				<button type="button" class="viewer__close" onclick={close} aria-label="Close viewer">
					<Icon name="close" />
				</button>
			</div>
		</div>

		<div
			bind:this={viewport}
			class="viewer__stage"
			class:zoomed={scale > 1}
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			role="presentation"
		>
			<img
				src={face.art.original}
				alt={face.alt}
				width={face.art.width}
				height={face.art.height}
				draggable="false"
				style:transform="translate({tx}px, {ty}px) scale({scale})"
			/>
		</div>

		<p class="viewer__help t-fine">Specimen. ← → change note · F turn over · + − zoom</p>
		<p class="visually-hidden" aria-live="polite">{announcement}</p>
	{/if}
</dialog>

<style>
	.viewer {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: var(--c-navy-900);
		color: var(--c-parchment);
		--fg: var(--c-parchment);
		--fg-muted: var(--c-parchment-400);
		--focus-ring: var(--c-gold);
	}

	.viewer[open] {
		display: grid;
		grid-template-rows: auto 1fr auto;
	}

	.viewer::backdrop {
		background: rgb(5 12 24 / 0.8);
	}

	.viewer__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) var(--gutter);
		border-bottom: var(--hairline) solid var(--rule-inverse);
	}

	.viewer__title {
		font-size: var(--fs-h4);
		font-weight: 600;
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.viewer__side {
		color: var(--c-gold);
	}

	.viewer__tools {
		display: flex;
		gap: var(--space-1);
	}

	.viewer__tools button {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-control);
	}

	.viewer__tools button:hover:not(:disabled) {
		background: rgb(244 238 223 / 0.1);
	}

	.viewer__tools button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.viewer__tools button[aria-pressed='true'] {
		color: var(--c-gold);
	}

	.viewer__close {
		margin-left: var(--space-2);
		border-left: var(--hairline) solid var(--rule-inverse) !important;
	}

	.viewer__stage {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		padding: var(--space-5) var(--gutter);
		touch-action: none;
		cursor: zoom-in;
		user-select: none;
	}

	.viewer__stage.zoomed {
		cursor: grab;
	}

	.viewer__stage img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		transform-origin: center;
		box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.8);
		transition: transform var(--dur-2) var(--ease-out-quart);
	}

	.viewer__stage.zoomed img {
		transition: none;
	}

	.viewer__help {
		padding: var(--space-3) var(--gutter) var(--space-4);
		color: var(--c-parchment-400);
		text-align: center;
	}
</style>
