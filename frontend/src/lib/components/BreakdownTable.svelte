<script lang="ts">
	import { formatComplianceType } from '$lib/format';
	import type { MetricsTotals } from '$lib/types';

	interface BreakdownRow extends MetricsTotals {
		label: string;
	}

	interface Props {
		title: string;
		rows: BreakdownRow[];
		labelHeader: string;
	}

	let { title, rows, labelHeader }: Props = $props();
</script>

{#if rows.length > 0}
	<section class="breakdown-table">
		<h3>{title}</h3>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">{labelHeader}</th>
						<th scope="col">Active</th>
						<th scope="col">Expiring</th>
						<th scope="col">Expired</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.label)}
						<tr>
							<td>{labelHeader === 'Type' ? formatComplianceType(row.label) : row.label}</td>
							<td>{row.active}</td>
							<td>{row.expiring}</td>
							<td>{row.expired}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}
