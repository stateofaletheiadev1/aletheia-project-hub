<script lang="ts">
	import { serializeJsonLd, type JsonLd } from '$lib/seo/jsonld';

	let { data }: { data: JsonLd | JsonLd[] } = $props();

	// serializeJsonLd escapes "<", so the content cannot break out of the script element.
	const tag = $derived(`<script type="application/ld+json">${serializeJsonLd(data)}</` + 'script>');
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html tag}
</svelte:head>
