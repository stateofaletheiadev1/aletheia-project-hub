<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		type = 'button',
		class: className = '',
		children,
		...rest
	}: HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'quiet';
		children: Snippet;
	} = $props();
</script>

<button {type} class="btn btn--{variant} {className}" {...rest}>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-control);
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		transition:
			background-color var(--dur-1) var(--ease-out-quart),
			color var(--dur-1) var(--ease-out-quart),
			border-color var(--dur-1) var(--ease-out-quart);
	}

	.btn--primary {
		background: var(--fg);
		color: var(--bg);
		border: var(--hairline) solid var(--fg);
	}

	.btn--primary:hover {
		background: color-mix(in oklab, var(--fg) 86%, var(--bg));
	}

	.btn--secondary {
		border: var(--hairline) solid var(--line-strong);
		color: var(--fg);
	}

	.btn--secondary:hover {
		border-color: var(--fg);
	}

	.btn--quiet {
		padding-inline: var(--space-2);
		color: var(--fg);
	}

	.btn--quiet:hover {
		background: color-mix(in oklab, var(--fg) 8%, transparent);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
