<script lang="ts" module>
	/** 24 × 24 line icons, 1.5 stroke. Drawn for this site; no emoji, no icon fonts. */
	export const ICONS = {
		'arrow-right': 'M4 12h15M13 6l6 6-6 6',
		'arrow-left': 'M20 12H5M11 6l-6 6 6 6',
		'arrow-up-right': 'M7 17 17 7M9 7h8v8',
		'chevron-down': 'm6 9 6 6 6-6',
		'chevron-left': 'm15 6-6 6 6 6',
		'chevron-right': 'm9 6 6 6-6 6',
		menu: 'M3 7h18M3 12h18M3 17h18',
		close: 'M6 6l12 12M18 6 6 18',
		plus: 'M12 5v14M5 12h14',
		minus: 'M5 12h14',
		flip: 'M4 9h13l-3-3M20 15H7l3 3',
		'zoom-in':
			'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15.5 20 20M10.5 7.5v6M7.5 10.5h6',
		'zoom-out': 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15.5 20 20M7.5 10.5h6',
		download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
		document: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6'
	} as const;
	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	let {
		name,
		size = 20,
		label,
		class: className = ''
	}: { name: IconName; size?: number; label?: string; class?: string } = $props();
</script>

<svg
	class="icon {className}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="square"
	stroke-linejoin="miter"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
>
	<path d={ICONS[name]} />
</svg>

<style>
	.icon {
		display: inline-block;
		flex: none;
		vertical-align: -0.2em;
	}
</style>
