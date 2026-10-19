<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		as = 'div',
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLElement> & { as?: string; children: Snippet } = $props();
</script>

<svelte:element this={as} class="container {className}" {...rest}>
	{@render children()}
</svelte:element>
