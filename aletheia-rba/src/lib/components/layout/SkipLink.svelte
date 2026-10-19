<a class="skip-link" href="#main">Skip to main content</a>

<style>
	.skip-link {
		position: fixed;
		top: var(--space-3);
		left: var(--space-3);
		z-index: calc(var(--z-dialog) + 1);
		padding: var(--space-3) var(--space-5);
		background: var(--c-navy);
		color: var(--c-parchment);
		font-weight: 650;
		text-decoration: none;
		transform: translateY(-200%);
		transition: transform var(--dur-2) var(--ease-out-quart);
		--focus-ring: var(--c-gold);
	}

	.skip-link:focus {
		transform: none;
	}
</style>
