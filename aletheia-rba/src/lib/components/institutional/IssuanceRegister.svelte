<script lang="ts">
	import type { IssuanceRecord } from '$lib/content/schema';
	import EmptyState from './EmptyState.svelte';

	/** The public issuance register (brief §8.6): empty now, typed records later. */
	let { records }: { records: IssuanceRecord[] } = $props();

	const fmtDate = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
</script>

{#if records.length === 0}
	<div data-testid="issuance-register-empty">
		<EmptyState title="Forthcoming" seed={33}>
			<p>Register entries will be published here.</p>
		</EmptyState>
	</div>
{:else}
	<table class="register" data-testid="issuance-register-table">
		<caption class="visually-hidden">Issuance register</caption>
		<thead>
			<tr>
				<th scope="col">Date</th>
				<th scope="col">Form</th>
				<th scope="col">Action</th>
				<th scope="col" class="num">Amount (AEY)</th>
				<th scope="col">Authority</th>
				<th scope="col">Source</th>
			</tr>
		</thead>
		<tbody>
			{#each records as r (r.sourceDocument.url + r.date + r.action)}
				<tr>
					<td><time datetime={r.date}>{fmtDate(r.date)}</time></td>
					<td>{r.form}{r.denomination ? `, ${r.denomination} AEY` : ''}</td>
					<td>{r.action}</td>
					<td class="num">{r.amount.toLocaleString('en-GB')}</td>
					<td>{r.authority}</td>
					<td><a href={r.sourceDocument.url}>{r.sourceDocument.title}</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.register {
		width: 100%;
		border-top: var(--hairline) solid var(--line-strong);
	}

	.register th,
	.register td {
		text-align: left;
		padding: var(--space-3) var(--space-4) var(--space-3) 0;
		border-bottom: var(--hairline) solid var(--line);
	}

	.register th {
		font-size: var(--fs-fine);
		letter-spacing: var(--track-meta);
		text-transform: uppercase;
		color: var(--fg-muted);
	}

	.register .num {
		text-align: right;
	}
</style>
