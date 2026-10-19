<script lang="ts">
	import { STATUS, type StatusKey } from '$lib/content/status';

	/**
	 * Status as a text label plus a shape, never colour alone (WCAG 1.4.1). Shapes progress from an
	 * empty ring (proposed) to a full disc (operational); "not yet established" is a dashed ring
	 * with a bar. All shapes use the current text colour.
	 */
	let {
		status,
		asOf,
		size = 'md'
	}: { status: StatusKey; asOf?: string; size?: 'sm' | 'md' } = $props();

	const info = $derived(STATUS[status]);
	const asOfLabel = $derived(
		asOf
			? new Date(`${asOf}T00:00:00Z`).toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					timeZone: 'UTC'
				})
			: null
	);
</script>

<span class="badge badge--{size}" title={info.description}>
	<svg
		class="shape"
		viewBox="0 0 16 16"
		width="14"
		height="14"
		aria-hidden="true"
		focusable="false"
	>
		{#if status === 'not_established'}
			<circle
				cx="8"
				cy="8"
				r="6.25"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-dasharray="2.4 2"
			/>
			<path d="M5 8h6" stroke="currentColor" stroke-width="1.5" />
		{:else}
			<circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
			{#if status === 'adopted'}
				<path d="M8 1.75a6.25 6.25 0 0 0 0 12.5z" fill="currentColor" />
			{:else if status === 'in_implementation'}
				<path d="M8 8V1.75A6.25 6.25 0 1 0 14.25 8z" fill="currentColor" />
			{:else if status === 'operational'}
				<circle cx="8" cy="8" r="6.25" fill="currentColor" />
			{/if}
		{/if}
	</svg>
	<span class="label">{info.label}</span>
	{#if asOfLabel}
		<span class="as-of">as of <time datetime={asOf}>{asOfLabel}</time></span>
	{/if}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		font-size: var(--fs-meta);
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.3;
		color: var(--fg);
	}

	.badge--sm {
		font-size: var(--fs-fine);
	}

	.shape {
		flex: none;
	}

	.as-of {
		font-weight: 450;
		letter-spacing: 0;
		color: var(--fg-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
