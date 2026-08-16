<script lang="ts">
	import { formatComplianceType, formatDate } from '$lib/format';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		COMPLIANCE_TYPES,
		type ComplianceRecord,
		type ComplianceStatus,
		type ComplianceType,
		type Employee,
		EDITABLE_COMPLIANCE_STATUSES
	} from '$lib/types';

	export interface RecordListFilters {
		employeeId: string;
		status: string;
		type: ComplianceType | '';
		expiryFrom: string;
		expiryTo: string;
	}

	interface Props {
		records: ComplianceRecord[];
		employees: Employee[];
		total: number;
		limit: number;
		offset: number;
		filters: RecordListFilters;
		loading?: boolean;
		onfilterchange?: (filters: RecordListFilters) => void;
		onpagechange?: (offset: number) => void;
		oncreate?: () => void;
		onedit?: (record: ComplianceRecord) => void;
		onrenew?: (record: ComplianceRecord) => void;
		onarchive?: (record: ComplianceRecord) => void;
	}

	let {
		records,
		employees,
		total,
		limit,
		offset,
		filters,
		loading = false,
		onfilterchange,
		onpagechange,
		oncreate,
		onedit,
		onrenew,
		onarchive
	}: Props = $props();

	const employeeLookup = $derived(new Map(employees.map((employee) => [employee.id, employee])));
	const pageStart = $derived(total === 0 ? 0 : offset + 1);
	const pageEnd = $derived(Math.min(offset + records.length, total));
	const hasPrevious = $derived(offset > 0);
	const hasNext = $derived(offset + limit < total);

	function employeeLabel(record: ComplianceRecord): string {
		const employee = employeeLookup.get(record.employeeId);
		return employee ? employee.name : `Employee #${record.employeeId}`;
	}

	function employeeDepartment(record: ComplianceRecord): string {
		return employeeLookup.get(record.employeeId)?.department ?? '—';
	}

	function isEditable(status: ComplianceStatus): boolean {
		return EDITABLE_COMPLIANCE_STATUSES.includes(status);
	}

	function applyFilters() {
		onfilterchange?.({ ...filters });
	}

	function resetFilters() {
		onfilterchange?.({
			employeeId: '',
			status: '',
			type: '',
			expiryFrom: '',
			expiryTo: ''
		});
	}

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

<section class="records-management">
	<div class="records-management__toolbar">
		<button type="button" class="btn-primary" onclick={() => oncreate?.()}>Create record</button>
	</div>

	<form
		class="records-filters"
		onsubmit={(event) => {
			event.preventDefault();
			applyFilters();
		}}
	>
		<div class="records-filters__fields">
			<label class="form-field">
				Employee
				<select bind:value={filters.employeeId}>
					<option value="">All employees</option>
					{#each employees as employee (employee.id)}
						<option value={employee.id}>{employee.name}</option>
					{/each}
				</select>
			</label>

			<label class="form-field">
				Status
				<select bind:value={filters.status}>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="expiring">Expiring</option>
					<option value="expired">Expired</option>
					<option value="renewed">Renewed</option>
					<option value="archived">Archived</option>
				</select>
			</label>

			<label class="form-field">
				Type
				<select bind:value={filters.type}>
					<option value="">All types</option>
					{#each COMPLIANCE_TYPES as complianceType (complianceType)}
						<option value={complianceType}>{formatComplianceType(complianceType)}</option>
					{/each}
				</select>
			</label>

			<label class="form-field">
				Expiry from
				<input type="date" bind:value={filters.expiryFrom} />
			</label>

			<label class="form-field">
				Expiry to
				<input type="date" bind:value={filters.expiryTo} />
			</label>
		</div>

		<div class="records-filters__actions">
			<button type="button" class="btn-outline" onclick={resetFilters}>Reset</button>
			<button type="submit" class="btn-primary">Apply</button>
		</div>
	</form>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">Employee</th>
					<th scope="col">Department</th>
					<th scope="col">Type</th>
					<th scope="col">Issued</th>
					<th scope="col">Expiry</th>
					<th scope="col">Status</th>
					<th scope="col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan="7" class="table-state">Loading records...</td>
					</tr>
				{:else if records.length === 0}
					<tr>
						<td colspan="7" class="table-state">No compliance records match these filters.</td>
					</tr>
				{:else}
					{#each records as record (record.id)}
						<tr>
							<td>{employeeLabel(record)}</td>
							<td>{employeeDepartment(record)}</td>
							<td>{formatComplianceType(record.type)}</td>
							<td>{formatDate(record.issuedDate)}</td>
							<td>{formatDate(record.expiryDate)}</td>
							<td><StatusBadge status={record.status} /></td>
							<td>
								<div class="row-actions">
									{#if isEditable(record.status)}
										<button type="button" class="btn-text" onclick={() => onedit?.(record)}>
											Edit
										</button>
										<button type="button" class="btn-text" onclick={() => onrenew?.(record)}>
											Renew
										</button>
										<button
											type="button"
											class="btn-text btn-text--danger"
											onclick={() => onarchive?.(record)}
										>
											Archive
										</button>
									{:else}
										<span class="row-actions__muted">—</span>
									{/if}
								</div>
							</td>
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
			<button type="button" disabled={!hasPrevious || loading} onclick={goPrevious}>Previous</button
			>
			<button type="button" disabled={!hasNext || loading} onclick={goNext}>Next</button>
		</div>
	</footer>
</section>
