<script lang="ts">
	import { formatComplianceType, formatDate } from '$lib/format';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { ExpiringRecord } from '$lib/types';

	interface Props {
		records: ExpiringRecord[];
		total: number;
		limit: number;
		offset: number;
		loading?: boolean;
		onpagechange?: (offset: number) => void;
	}

	let { records, total, limit, offset, loading = false, onpagechange }: Props = $props();

	const pageStart = $derived(total === 0 ? 0 : offset + 1);
	const pageEnd = $derived(Math.min(offset + records.length, total));
	const hasPrevious = $derived(offset > 0);
	const hasNext = $derived(offset + limit < total);

	function goPrevious() {
		if (hasPrevious) {
			onpagechange?.(Math.max(0, offset - limit));
		}
	}

	function goNext() {
		if (hasNext) {
			onpagechange?.(offset + limit);
		}
	}
</script>

<section class="records-table">
	<div
		class="table-wrap"
		class:table-wrap--busy={loading && records.length > 0}
		aria-busy={loading}
	>
		<table>
			<thead>
				<tr>
					<th scope="col">Employee</th>
					<th scope="col">Department</th>
					<th scope="col">Type</th>
					<th scope="col">Issued</th>
					<th scope="col">Expiry</th>
					<th scope="col">Status</th>
				</tr>
			</thead>
			<tbody>
				{#if loading && records.length === 0}
					<tr>
						<td colspan="6" class="table-state">Loading records...</td>
					</tr>
				{:else if records.length === 0}
					<tr>
						<td colspan="6" class="table-state">No records expiring in this window.</td>
					</tr>
				{:else}
					{#each records as record (record.id)}
						<tr>
							<td>{record.employeeName}</td>
							<td>{record.department}</td>
							<td>{formatComplianceType(record.type)}</td>
							<td>{formatDate(record.issuedDate)}</td>
							<td>{formatDate(record.expiryDate)}</td>
							<td><StatusBadge status={record.status} /></td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<footer class="records-table__footer">
		<p>
			{#if total === 0}
				Showing 0 records
			{:else}
				Showing {pageStart}-{pageEnd} of {total}
			{/if}
		</p>
		<div class="button-group">
			<button type="button" disabled={!hasPrevious || loading} onclick={goPrevious}>
				Previous
			</button>
			<button type="button" disabled={!hasNext || loading} onclick={goNext}>Next</button>
		</div>
	</footer>
</section>
