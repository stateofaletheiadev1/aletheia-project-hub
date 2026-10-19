<script lang="ts">
	import { C, RINGS, rosettePaths, starPath } from '$lib/brand/seal';

	/**
	 * The Reserve Bank of Aletheia seal. `seal` carries the legend around the rim and is for sizes
	 * of about 72 px and up; `mark` drops the lettering for small sizes. Colours follow the surface:
	 * lines in the foreground colour, the star in gold.
	 */
	let {
		variant = 'seal',
		size = 96,
		title
	}: { variant?: 'seal' | 'mark'; size?: number; title?: string } = $props();

	const uid = $props.id();
	const small = $derived(variant === 'mark' && size < 64);
	const rosette = $derived(small ? [] : rosettePaths(variant === 'mark' ? 78 : 58));
</script>

<svg
	class="seal seal--{variant}"
	width={size}
	height={size}
	viewBox="0 0 200 200"
	role={title ? 'img' : undefined}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
	focusable="false"
>
	<circle cx={C} cy={C} r={RINGS.outer} fill="none" class="line" stroke-width={small ? 9 : 3} />
	<circle
		cx={C}
		cy={C}
		r={RINGS.outerInner - (variant === 'mark' ? 1 : 0)}
		fill="none"
		class="line"
		stroke-width="1"
	/>

	{#if variant === 'seal'}
		<defs>
			<path
				id="top-{uid}"
				d="M {C - RINGS.text} {C} A {RINGS.text} {RINGS.text} 0 0 1 {C + RINGS.text} {C}"
			/>
			<path id="bottom-{uid}" d="M {C - 88} {C} A 88 88 0 0 0 {C + 88} {C}" />
		</defs>
		<text class="legend">
			<textPath href="#top-{uid}" startOffset="50%" text-anchor="middle"
				>RESERVE BANK OF ALETHEIA</textPath
			>
		</text>
		<text class="legend legend--small">
			<textPath href="#bottom-{uid}" startOffset="50%" text-anchor="middle"
				>VERITAS IN FOEDERE</textPath
			>
		</text>
		<path d={starPath(4.5, 1.6, 3)} class="star" transform="translate(-74 0)" />
		<path d={starPath(4.5, 1.6, 3)} class="star" transform="translate(74 0)" />
		<circle cx={C} cy={C} r={RINGS.inner} fill="none" class="line" stroke-width="1.25" />
	{/if}

	{#each rosette as d, i (i)}
		<path
			{d}
			fill="none"
			class="line"
			stroke-width={small ? 2.2 : i ? 0.5 : 0.7}
			opacity={i ? 0.65 : 0.95}
		/>
	{/each}

	{#if small}
		<!-- Below 64 px: ring and star only, so the mark stays crisp as a favicon. -->
		<path d={starPath(62, 19, 38)} class="star" />
	{:else}
		<circle cx={C} cy={C} r={variant === 'mark' ? 30 : 24} class="core" />
		<path d={variant === 'mark' ? starPath(26, 8.5, 16) : starPath(20, 6.5, 12.5)} class="star" />
	{/if}
</svg>

<style>
	.seal {
		display: block;
		flex: none;
		overflow: visible;
	}

	.line {
		stroke: currentColor;
	}

	.core {
		fill: var(--seal-ground, var(--bg, transparent));
		stroke: currentColor;
		stroke-width: 1.2;
	}

	.star {
		fill: var(--c-gold);
	}

	.legend {
		fill: currentColor;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 1.5px;
	}

	.legend--small {
		font-size: 9.5px;
		font-weight: 600;
		letter-spacing: 3px;
	}
</style>
