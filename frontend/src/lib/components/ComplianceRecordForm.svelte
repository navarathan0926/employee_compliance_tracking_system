<script lang="ts">
	import { formatComplianceType } from '$lib/format';
	import {
		COMPLIANCE_TYPES,
		type ComplianceRecord,
		type ComplianceType,
		type Employee
	} from '$lib/types';
	import {
		hasFieldErrors,
		type ComplianceFieldErrors,
		validateCreateComplianceRecord,
		validateUpdateComplianceRecord
	} from '$lib/validation';

	interface Props {
		mode: 'create' | 'edit';
		employees: Employee[];
		record?: ComplianceRecord;
		open: boolean;
		submitting?: boolean;
		serverError?: string;
		onclose?: () => void;
		onsubmit?: (payload: {
			employeeId: number;
			type: ComplianceType;
			issuedDate: string;
			expiryDate: string;
			notes: string;
		}) => void;
	}

	let {
		mode,
		employees,
		record,
		open,
		submitting = false,
		serverError = '',
		onclose,
		onsubmit
	}: Props = $props();

	let employeeId = $state(0);
	let type = $state<ComplianceType>('visa');
	let issuedDate = $state('');
	let expiryDate = $state('');
	let notes = $state('');
	let fieldErrors = $state<ComplianceFieldErrors>({});

	$effect(() => {
		if (!open) {
			return;
		}

		fieldErrors = {};
		employeeId = record?.employeeId ?? employees[0]?.id ?? 0;
		type = record?.type ?? 'visa';
		issuedDate = record?.issuedDate ?? '';
		expiryDate = record?.expiryDate ?? '';
		notes = record?.notes ?? '';
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		fieldErrors = {};

		if (mode === 'create') {
			fieldErrors = validateCreateComplianceRecord({
				employeeId,
				type,
				issuedDate,
				expiryDate,
				notes: notes.trim() || undefined
			});
		} else if (record) {
			fieldErrors = validateUpdateComplianceRecord(
				{
					issuedDate,
					expiryDate,
					notes: notes.trim() || undefined
				},
				record
			);
		}

		if (hasFieldErrors(fieldErrors)) {
			return;
		}

		onsubmit?.({
			employeeId,
			type,
			issuedDate,
			expiryDate,
			notes: notes.trim()
		});
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose?.();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onclose?.();
		}
	}
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
			<header class="modal__header">
				<h2 id="record-form-title">{mode === 'create' ? 'Create record' : 'Edit record'}</h2>
				<button type="button" class="btn-text" onclick={() => onclose?.()} aria-label="Close">
					Close
				</button>
			</header>

			{#if serverError}
				<p class="form-error" role="alert">{serverError}</p>
			{/if}

			<form class="modal__form" onsubmit={handleSubmit}>
				{#if mode === 'create'}
					<label class="form-field">
						Employee
						<select bind:value={employeeId} aria-invalid={Boolean(fieldErrors.employeeId)}>
							<option value={0} disabled>Select employee</option>
							{#each employees as employee (employee.id)}
								<option value={employee.id}>{employee.name} ({employee.department})</option>
							{/each}
						</select>
						{#if fieldErrors.employeeId}
							<span class="field-error">{fieldErrors.employeeId}</span>
						{/if}
					</label>

					<label class="form-field">
						Type
						<select bind:value={type} aria-invalid={Boolean(fieldErrors.type)}>
							{#each COMPLIANCE_TYPES as complianceType (complianceType)}
								<option value={complianceType}>{formatComplianceType(complianceType)}</option>
							{/each}
						</select>
						{#if fieldErrors.type}
							<span class="field-error">{fieldErrors.type}</span>
						{/if}
					</label>
				{:else if record}
					<p class="form-readonly">
						<strong>Employee:</strong>
						{record.employee?.name ?? `Employee #${record.employeeId}`}
					</p>
					<p class="form-readonly">
						<strong>Type:</strong>
						{formatComplianceType(record.type)}
					</p>
					<p class="form-readonly">
						<strong>Status:</strong>
						{record.status}
					</p>
				{/if}

				<label class="form-field">
					Issued date
					<input
						type="date"
						bind:value={issuedDate}
						aria-invalid={Boolean(fieldErrors.issuedDate)}
					/>
					{#if fieldErrors.issuedDate}
						<span class="field-error">{fieldErrors.issuedDate}</span>
					{/if}
				</label>

				<label class="form-field">
					Expiry date
					<input
						type="date"
						bind:value={expiryDate}
						aria-invalid={Boolean(fieldErrors.expiryDate)}
					/>
					{#if fieldErrors.expiryDate}
						<span class="field-error">{fieldErrors.expiryDate}</span>
					{/if}
				</label>

				<label class="form-field">
					Notes
					<textarea rows="3" bind:value={notes} placeholder="Optional notes"></textarea>
				</label>

				<footer class="modal__footer">
					<button
						type="button"
						class="btn-secondary"
						onclick={() => onclose?.()}
						disabled={submitting}
					>
						Cancel
					</button>
					<button type="submit" class="btn-primary" disabled={submitting}>
						{submitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save changes'}
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
