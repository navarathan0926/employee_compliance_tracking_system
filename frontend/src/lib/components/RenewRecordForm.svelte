<script lang="ts">
	import CloseButton from '$lib/components/CloseButton.svelte';
	import type { ComplianceRecord } from '$lib/types';
	import {
		hasFieldErrors,
		type ComplianceFieldErrors,
		validateRenewComplianceRecord
	} from '$lib/validation';

	interface Props {
		record: ComplianceRecord | null;
		open: boolean;
		submitting?: boolean;
		serverError?: string;
		onclose?: () => void;
		onsubmit?: (payload: { issuedDate: string; expiryDate: string; notes: string }) => void;
	}

	let { record, open, submitting = false, serverError = '', onclose, onsubmit }: Props = $props();

	let issuedDate = $state('');
	let expiryDate = $state('');
	let notes = $state('');
	let fieldErrors = $state<ComplianceFieldErrors>({});

	$effect(() => {
		if (!open) {
			return;
		}

		fieldErrors = {};
		issuedDate = '';
		expiryDate = '';
		notes = record?.notes ?? '';
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		fieldErrors = validateRenewComplianceRecord({
			issuedDate,
			expiryDate,
			notes: notes.trim() || undefined
		});

		if (hasFieldErrors(fieldErrors)) {
			return;
		}

		onsubmit?.({
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

{#if open && record}
	<div
		class="modal-backdrop"
		role="presentation"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="renew-form-title">
			<header class="modal__header">
				<h2 id="renew-form-title">Renew record #{record.id}</h2>
				<CloseButton onclick={() => onclose?.()} />
			</header>

			<p class="modal__hint">
				Creates a new compliance record and marks this one as renewed. Current expiry:
				<strong>{record.expiryDate}</strong>
			</p>

			{#if serverError}
				<p class="form-error" role="alert">{serverError}</p>
			{/if}

			<form class="modal__form" onsubmit={handleSubmit}>
				<label class="form-field">
					New issued date
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
					New expiry date
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
					<textarea rows="3" bind:value={notes} placeholder="Optional renewal notes"></textarea>
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
						{submitting ? 'Renewing...' : 'Renew'}
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
