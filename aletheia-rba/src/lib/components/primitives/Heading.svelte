<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Level = 1 | 2 | 3 | 4 | 5 | 6;
	type Size = 'display' | 'h1' | 'h2' | 'h3' | 'h4';

	/** The document level (h1-h6) and the visual size are independent. */
	let {
		level,
		size,
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLHeadingElement> & {
		level: Level;
		size?: Size;
		children: Snippet;
	} = $props();

	const defaults: Record<Level, Size> = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h4', 6: 'h4' };
	const visual = $derived(size ?? defaults[level]);
</script>

<svelte:element this={`h${level}`} class="t-{visual} {className}" {...rest}>
	{@render children()}
</svelte:element>
