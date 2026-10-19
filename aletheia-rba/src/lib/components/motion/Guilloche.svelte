<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import { lattice, rosette } from './guilloche';

	/**
	 * Procedural guilloché ornament. Decorative only (aria-hidden). With `draw`, the lines are drawn
	 * in on first reveal; without JS or with reduced motion they are simply present.
	 */
	let {
		kind = 'rosette',
		seed = 1,
		size = 320,
		width = 960,
		height = 240,
		layers = 4,
		lines = 18,
		draw = false,
		stroke = 'var(--ornament)',
		strokeWidth = 0.6,
		class: className = ''
	}: {
		kind?: 'rosette' | 'lattice';
		seed?: number;
		size?: number;
		width?: number;
		height?: number;
		layers?: number;
		lines?: number;
		draw?: boolean;
		stroke?: string;
		strokeWidth?: number;
		class?: string;
	} = $props();

	const paths = $derived(
		kind === 'rosette' ? rosette(seed, size, layers) : lattice(seed, width, height, lines)
	);
	const viewBox = $derived(kind === 'rosette' ? `0 0 ${size} ${size}` : `0 0 ${width} ${height}`);
</script>

{#if draw}
	<svg
		class="guilloche {className}"
		{viewBox}
		aria-hidden="true"
		focusable="false"
		data-draw
		use:reveal
		preserveAspectRatio={kind === 'lattice' ? 'none' : undefined}
	>
		{#each paths as p, i (i)}
			<path
				d={p.d}
				pathLength="1"
				fill="none"
				{stroke}
				stroke-width={strokeWidth}
				vector-effect={kind === 'lattice' ? 'non-scaling-stroke' : undefined}
				opacity={p.weight}
				style:--layer={i}
			/>
		{/each}
	</svg>
{:else}
	<svg
		class="guilloche {className}"
		{viewBox}
		aria-hidden="true"
		focusable="false"
		preserveAspectRatio={kind === 'lattice' ? 'none' : undefined}
	>
		{#each paths as p, i (i)}
			<path
				d={p.d}
				fill="none"
				{stroke}
				stroke-width={strokeWidth}
				vector-effect={kind === 'lattice' ? 'non-scaling-stroke' : undefined}
				opacity={p.weight}
			/>
		{/each}
	</svg>
{/if}

<style>
	.guilloche {
		width: 100%;
		height: auto;
		overflow: visible;
	}
</style>
