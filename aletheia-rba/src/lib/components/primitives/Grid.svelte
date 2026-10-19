<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/** 12-column grid; children take `md:span-*`, `lg:span-*` and `lg:start-*` classes. */
	let {
		as = 'div',
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLElement> & { as?: string; children: Snippet } = $props();
</script>

<svelte:element this={as} class="grid {className}" {...rest}>
	{@render children()}
</svelte:element>
