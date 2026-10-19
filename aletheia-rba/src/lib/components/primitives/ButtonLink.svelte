<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	/** A link styled as a button. For actions, use Button. */
	let {
		href,
		variant = 'primary',
		arrow = true,
		class: className = '',
		children,
		...rest
	}: HTMLAnchorAttributes & {
		href: string;
		variant?: 'primary' | 'secondary';
		arrow?: boolean;
		children: Snippet;
	} = $props();
</script>

<a {href} class="btn-link btn-link--{variant} {className}" {...rest}>
	<span>{@render children()}</span>
	{#if arrow}<Icon name="arrow-right" size={16} class="nudge" />{/if}
</a>

<style>
	.btn-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 44px;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-control);
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		text-decoration: none;
		transition:
			background-color var(--dur-1) var(--ease-out-quart),
			border-color var(--dur-1) var(--ease-out-quart);
	}

	.btn-link--primary {
		background: var(--fg);
		color: var(--bg);
		border: var(--hairline) solid var(--fg);
	}

	.btn-link--primary:hover {
		background: color-mix(in oklab, var(--fg) 86%, var(--bg));
	}

	.btn-link--secondary {
		color: var(--fg);
		border: var(--hairline) solid var(--line-strong);
	}

	.btn-link--secondary:hover {
		border-color: var(--fg);
	}
</style>
