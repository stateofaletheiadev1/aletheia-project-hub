<script lang="ts">
	/**
	 * Ledger rules. `hair` and `strong` structure content; `seal` is the double gold rule used
	 * sparingly as ornament (decorative, so gold on parchment is acceptable here).
	 */
	let {
		variant = 'hair',
		class: className = ''
	}: { variant?: 'hair' | 'strong' | 'seal'; class?: string } = $props();
</script>

<hr class="rule rule--{variant} {className}" />

<style>
	.rule {
		border: 0;
		height: 0;
		border-top: var(--hairline) solid var(--line);
	}

	.rule--strong {
		border-top-color: var(--line-strong);
	}

	.rule--seal {
		height: 4px;
		border-top: var(--hairline) solid var(--ornament);
		border-bottom: var(--hairline) solid var(--ornament);
		opacity: 0.8;
	}
</style>
