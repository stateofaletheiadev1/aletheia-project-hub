<script lang="ts">
	import type { Snippet } from 'svelte';
	import manropeLatin from '$lib/assets/fonts/manrope-latin-wght-normal.woff2?url';
	import '$lib/styles/global.css';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="preload" href={manropeLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
