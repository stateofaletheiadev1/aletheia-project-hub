<script lang="ts">
	import type { ReserveReport } from '$lib/content/schema';
	import EmptyState from './EmptyState.svelte';

	/**
	 * Reserve reporting module (brief §8.7). Renders a designed empty state today; given validated
	 * reports, a structured table. A figure is never shown without its source document.
	 */
	let { reports }: { reports: ReserveReport[] } = $props();

	const fmtDate = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	const fmtAmount = (n: number, currency: string) =>
		new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency,
			maximumFractionDigits: 0
		}).format(n);
</script>

{#if reports.length === 0}
	<div data-testid="reserve-reports-empty">
		<EmptyState title="Forthcoming" seed={18}>
			<p>Reserve reports will be published here.</p>
		</EmptyState>
	</div>
{:else}
	<table class="reports" data-testid="reserve-reports-table">
		<caption class="visually-hidden">Published reserve reports</caption>
		<thead>
			<tr>
				<th scope="col">Period</th>
				<th scope="col">Asset class</th>
				<th scope="col" class="num">Amount</th>
				<th scope="col">Auditor</th>
				<th scope="col">Source</th>
			</tr>
		</thead>
		<tbody>
			{#each reports as r (r.sourceDocument.url + r.assetClass)}
				<tr>
					<td>{fmtDate(r.period.from)} to {fmtDate(r.period.to)}</td>
					<td>{r.assetClass}</td>
					<td class="num">{fmtAmount(r.amount, r.currency)}</td>
					<td>{r.auditor ?? 'Not audited'}</td>
					<td><a href={r.sourceDocument.url}>{r.sourceDocument.title}</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.reports {
		width: 100%;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.reports th,
	.reports td {
		text-align: left;
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		border-bottom: var(--hairline) solid var(--line);
	}

	.reports th {
		font-size: var(--fs-fine);
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.reports .num {
		text-align: right;
	}
</style>
