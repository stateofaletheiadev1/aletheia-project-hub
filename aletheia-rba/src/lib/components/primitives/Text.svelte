<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Size = 'lead' | 'body' | 'meta' | 'fine';

	let {
		as = 'p',
		size = 'body',
		muted = false,
		measure = false,
		class: className = '',
		children,
		...rest
	}: HTMLAttributes<HTMLElement> & {
		as?: string;
		size?: Size;
		muted?: boolean;
		measure?: boolean;
		children: Snippet;
	} = $props();
</script>

<svelte:element
	this={as}
	class="t-{size} {className}"
	class:t-muted={muted}
	class:measure
	{...rest}
>
	{@render children()}
</svelte:element>
