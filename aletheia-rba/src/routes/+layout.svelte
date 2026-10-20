<script lang="ts">
	import type { Snippet } from 'svelte';
	import manropeLatin from '$lib/assets/fonts/manrope-latin-wght-normal.woff2?url';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Masthead from '$lib/components/layout/Masthead.svelte';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';
	import { news } from '$lib/content';
	import '$lib/styles/global.css';

	let { children }: { children: Snippet } = $props();

	// Marks the page as interactive once hydrated (used by the browser tests).
	$effect(() => {
		document.documentElement.dataset.hydrated = '';
	});
</script>

<svelte:head>
	<link rel="preload" href={manropeLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="icon" href="/rba-mark.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	{#if news.length}
		<link rel="alternate" type="application/rss+xml" title="News and notices" href="/news.xml" />
	{/if}
</svelte:head>

<SkipLink />
<Masthead />
<main id="main" tabindex="-1">
	{@render children()}
</main>
<Footer />

<style>
	main {
		display: block;
		outline: none;
	}
</style>
