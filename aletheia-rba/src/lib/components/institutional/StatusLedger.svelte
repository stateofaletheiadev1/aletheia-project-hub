<script lang="ts">
	import type { StatusItem } from '$lib/content/schema';
	import StatusBadge from './StatusBadge.svelte';

	/**
	 * The status ledger as a ruled table. `compact` drops the explanations for the home page.
	 */
	let {
		items,
		compact = false,
		caption
	}: { items: StatusItem[]; compact?: boolean; caption: string } = $props();

	const formatDate = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
</script>

<table class="ledger-table" class:compact>
	<caption class="visually-hidden">{caption}</caption>
	<thead>
		<tr>
			<th scope="col">Capability</th>
			<th scope="col">Status</th>
			<th scope="col" class="as-of">As of</th>
		</tr>
	</thead>
	<tbody>
		{#each items as item (item.id)}
			<tr>
				<th scope="row">
					{#if item.link}
						<a href={item.link}>{item.capability}</a>
					{:else}
						{item.capability}
					{/if}
					{#if !compact}<span class="explain">{item.explanation}</span>{/if}
				</th>
				<td><StatusBadge status={item.status} /></td>
				<td class="as-of"><time datetime={item.statusAsOf}>{formatDate(item.statusAsOf)}</time></td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.ledger-table {
		width: 100%;
		font-variant-numeric: tabular-nums lining-nums;
		border-top: var(--hairline) solid var(--line-strong);
	}

	thead th {
		text-align: left;
		font-size: var(--fs-fine);
		font-weight: 600;
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		border-bottom: var(--hairline) solid var(--line-strong);
	}

	tbody th,
	tbody td {
		text-align: left;
		vertical-align: top;
		padding: var(--space-4) var(--space-4) var(--space-4) 0;
		border-bottom: var(--hairline) solid var(--line);
	}

	tbody th {
		font-weight: 600;
		width: 60%;
	}

	tbody th a {
		text-decoration-color: var(--line-strong);
	}

	.explain {
		display: block;
		margin-top: var(--space-1);
		font-weight: 400;
		color: var(--fg-muted);
		max-width: 60ch;
	}

	.as-of {
		white-space: nowrap;
		color: var(--fg-muted);
		font-size: var(--fs-meta);
		text-align: right;
		padding-right: 0;
	}

	thead .as-of {
		text-align: right;
	}

	.compact tbody th,
	.compact tbody td {
		padding-block: var(--space-3);
	}

	@media (max-width: 599px) {
		.as-of {
			display: none;
		}

		tbody th {
			width: auto;
		}
	}
</style>
