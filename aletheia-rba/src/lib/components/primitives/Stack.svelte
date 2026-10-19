<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Gap = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

	let {
		as = 'div',
		gap = 4,
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLElement> & { as?: string; gap?: Gap; children: Snippet } = $props();
</script>

<svelte:element
	this={as}
	class="stack {className}"
	style:--stack-gap="var(--space-{gap})"
	{...rest}
>
	{@render children()}
</svelte:element>
