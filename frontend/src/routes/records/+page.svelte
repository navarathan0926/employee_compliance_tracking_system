<script lang="ts">
	import { onMount } from 'svelte';
	import ComplianceRecordForm from '$lib/components/ComplianceRecordForm.svelte';
	import ComplianceRecordsTable, {
		type RecordListFilters
	} from '$lib/components/ComplianceRecordsTable.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import RenewRecordForm from '$lib/components/RenewRecordForm.svelte';
	import {
		ApiError,
		archiveComplianceRecord,
		createComplianceRecord,
		getComplianceRecord,
		listComplianceRecords,
		listEmployees,
		renewComplianceRecord,
		updateComplianceRecord
	} from '$lib/api';
	import { formatComplianceType } from '$lib/format';
	import { DEFAULT_PAGE_LIMIT } from '$lib/query';
	import { notify } from '$lib/toast.svelte';
	import type { ComplianceRecord, ComplianceType, Employee } from '$lib/types';

	let employees = $state<Employee[]>([]);
	let records = $state<ComplianceRecord[]>([]);
	let total = $state(0);
	let limit = $state(DEFAULT_PAGE_LIMIT);
	let offset = $state(0);
	let loading = $state(true);
	let listError = $state('');

	let filters = $state<RecordListFilters>({
		employeeId: '',
		status: '',
		type: '',
		expiryFrom: '',
		expiryTo: ''
	});

	let formOpen = $state(false);
	let formMode = $state<'create' | 'edit'>('create');
	let editingRecord = $state<ComplianceRecord | null>(null);
	let formSubmitting = $state(false);
	let formError = $state('');

	let renewOpen = $state(false);
	let renewingRecord = $state<ComplianceRecord | null>(null);
	let renewSubmitting = $state(false);
	let renewError = $state('');

	let archiveTarget = $state<ComplianceRecord | null>(null);
	let archiveBusy = $state(false);
	let archiveError = $state('');

	async function loadEmployees() {
		const response = await listEmployees({ limit: 200, offset: 0 });
		employees = response.data;
	}

	async function loadRecords() {
		loading = true;
		listError = '';

		try {
			const response = await listComplianceRecords({
				limit,
				offset,
				employeeId: filters.employeeId === '' ? undefined : Number(filters.employeeId),
				status: filters.status || undefined,
				type: filters.type || undefined,
				expiryFrom: filters.expiryFrom || undefined,
				expiryTo: filters.expiryTo || undefined
			});

			records = response.data;
			total = response.total;
			limit = response.limit;
			offset = response.offset;
		} catch (error) {
			if (records.length === 0) {
				total = 0;
			}
			listError = error instanceof Error ? error.message : 'Failed to load compliance records.';
		} finally {
			loading = false;
		}
	}

	function handleFilterChange(nextFilters: RecordListFilters) {
		filters = nextFilters;
		offset = 0;
		void loadRecords();
	}

	function handlePageChange(nextOffset: number) {
		offset = nextOffset;
		void loadRecords();
	}

	function openCreateForm() {
		formMode = 'create';
		editingRecord = null;
		formError = '';
		formOpen = true;
	}

	async function openEditForm(record: ComplianceRecord) {
		formMode = 'edit';
		formError = '';
		formSubmitting = true;
		formOpen = true;

		try {
			editingRecord = await getComplianceRecord(record.id);
		} catch (error) {
			formOpen = false;
			listError = error instanceof Error ? error.message : 'Failed to load record for editing.';
		} finally {
			formSubmitting = false;
		}
	}

	function closeForm() {
		formOpen = false;
		formError = '';
		editingRecord = null;
	}

	async function handleFormSubmit(payload: {
		employeeId: number;
		type: ComplianceType;
		issuedDate: string;
		expiryDate: string;
		notes: string;
	}) {
		formSubmitting = true;
		formError = '';

		try {
			if (formMode === 'create') {
				await createComplianceRecord({
					employeeId: payload.employeeId,
					type: payload.type,
					issuedDate: payload.issuedDate,
					expiryDate: payload.expiryDate,
					notes: payload.notes || undefined
				});
				notify(`Created ${formatComplianceType(payload.type)} record.`);
			} else if (editingRecord) {
				await updateComplianceRecord(editingRecord.id, {
					issuedDate: payload.issuedDate,
					expiryDate: payload.expiryDate,
					notes: payload.notes || undefined
				});
				notify(`Updated ${formatComplianceType(editingRecord.type)} record.`);
			}

			closeForm();
			await loadRecords();
		} catch (error) {
			formError = error instanceof ApiError ? error.message : 'Unable to save compliance record.';
		} finally {
			formSubmitting = false;
		}
	}

	function openRenewForm(record: ComplianceRecord) {
		renewingRecord = record;
		renewError = '';
		renewOpen = true;
	}

	function closeRenewForm() {
		renewOpen = false;
		renewError = '';
		renewingRecord = null;
	}

	async function handleRenewSubmit(payload: {
		issuedDate: string;
		expiryDate: string;
		notes: string;
	}) {
		if (!renewingRecord) {
			return;
		}

		renewSubmitting = true;
		renewError = '';

		try {
			await renewComplianceRecord(renewingRecord.id, {
				issuedDate: payload.issuedDate,
				expiryDate: payload.expiryDate,
				notes: payload.notes || undefined
			});

			notify(`Renewed ${formatComplianceType(renewingRecord.type)} record.`);
			closeRenewForm();
			await loadRecords();
		} catch (error) {
			renewError = error instanceof ApiError ? error.message : 'Unable to renew compliance record.';
		} finally {
			renewSubmitting = false;
		}
	}

	function employeeName(record: ComplianceRecord): string {
		const employee = employees.find((item) => item.id === record.employeeId);
		return employee?.name ?? record.employee?.name ?? 'this employee';
	}

	function openArchiveDialog(record: ComplianceRecord) {
		archiveTarget = record;
		archiveError = '';
	}

	function closeArchiveDialog() {
		if (archiveBusy) {
			return;
		}

		archiveTarget = null;
		archiveError = '';
	}

	async function confirmArchive() {
		if (!archiveTarget) {
			return;
		}

		archiveBusy = true;
		archiveError = '';
		listError = '';

		try {
			const type = formatComplianceType(archiveTarget.type);
			const name = employeeName(archiveTarget);
			await archiveComplianceRecord(archiveTarget.id);
			archiveTarget = null;
			notify(`Archived ${name}'s ${type}.`);
			await loadRecords();
		} catch (error) {
			archiveError =
				error instanceof ApiError ? error.message : 'Unable to archive compliance record.';
		} finally {
			archiveBusy = false;
		}
	}

	onMount(() => {
		void (async () => {
			try {
				await loadEmployees();
				await loadRecords();
			} catch (error) {
				listError = error instanceof Error ? error.message : 'Failed to load page data.';
				loading = false;
			}
		})();
	});
</script>

<section class="page-section">
	<div class="section-header">
		<div>
			<h2>Compliance records</h2>
			<p class="section-subtitle">Create, update, renew, and archive employee compliance items.</p>
		</div>
	</div>

	{#if listError}
		<div class="error-banner" role="alert">
			<p>{listError}</p>
			<button type="button" class="btn-secondary" onclick={loadRecords}>Retry</button>
		</div>
	{/if}

	<ComplianceRecordsTable
		{records}
		{employees}
		{total}
		{limit}
		{offset}
		{filters}
		{loading}
		onfilterchange={handleFilterChange}
		onpagechange={handlePageChange}
		oncreate={openCreateForm}
		onedit={openEditForm}
		onrenew={openRenewForm}
		onarchive={openArchiveDialog}
	/>
</section>

<ComplianceRecordForm
	mode={formMode}
	{employees}
	record={editingRecord ?? undefined}
	open={formOpen}
	submitting={formSubmitting}
	serverError={formError}
	onclose={closeForm}
	onsubmit={handleFormSubmit}
/>

<RenewRecordForm
	record={renewingRecord}
	open={renewOpen}
	submitting={renewSubmitting}
	serverError={renewError}
	onclose={closeRenewForm}
	onsubmit={handleRenewSubmit}
/>

<ConfirmDialog
	open={archiveTarget !== null}
	title="Archive this record?"
	message={archiveTarget
		? `${employeeName(archiveTarget)}'s ${formatComplianceType(archiveTarget.type)} will be archived and removed from active lists.`
		: ''}
	confirmLabel="Archive"
	variant="danger"
	busy={archiveBusy}
	busyLabel="Archiving..."
	error={archiveError}
	oncancel={closeArchiveDialog}
	onconfirm={confirmArchive}
/>
