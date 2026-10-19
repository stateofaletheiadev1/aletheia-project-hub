<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	/**
	 * Internal or external link. External links show an outward arrow; `newTab` opens a new tab and
	 * says so to assistive technology. `arrow` adds the forward arrow used for calls to action.
	 */
	let {
		href,
		newTab = false,
		arrow = false,
		quiet = false,
		class: className = '',
		children,
		...rest
	}: HTMLAnchorAttributes & {
		href: string;
		newTab?: boolean;
		arrow?: boolean;
		quiet?: boolean;
		children: Snippet;
	} = $props();

	const external = $derived(/^https?:\/\//.test(href));
</script>

<a
	{href}
	class="link {className}"
	class:link--quiet={quiet}
	target={newTab ? '_blank' : undefined}
	rel={external ? (newTab ? 'noopener noreferrer' : 'noopener') : undefined}
	{...rest}
>
	{@render children()}
	{#if external}
		<Icon name="arrow-up-right" size={14} class="nudge" />
	{:else if arrow}
		<Icon name="arrow-right" size={16} class="nudge" />
	{/if}
	{#if newTab}<span class="visually-hidden"> (opens in a new tab)</span>{/if}
</a>

<style>
	.link--quiet {
		text-decoration: none;
	}

	.link--quiet:hover {
		text-decoration: underline;
		text-decoration-color: currentColor;
	}
</style>
