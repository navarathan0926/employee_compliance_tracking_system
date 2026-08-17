<script lang="ts">
	import CloseButton from '$lib/components/CloseButton.svelte';
	import { tick } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'danger' | 'primary';
		busy?: boolean;
		busyLabel?: string;
		error?: string;
		oncancel?: () => void;
		onconfirm?: () => void;
	}

	let {
		open,
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'primary',
		busy = false,
		busyLabel = 'Working...',
		error = '',
		oncancel,
		onconfirm
	}: Props = $props();

	let dialogEl: HTMLDivElement | undefined = $state();
	const uid = $props.id();
	const titleId = `${uid}-title`;
	const messageId = `${uid}-message`;

	$effect(() => {
		if (!open) {
			return;
		}

		void tick().then(() => {
			dialogEl?.focus();
		});
	});

	function handleBackdropClick(event: MouseEvent) {
		if (busy) {
			return;
		}

		if (event.target === event.currentTarget) {
			oncancel?.();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !busy) {
			oncancel?.();
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!busy) {
			onconfirm?.();
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
		<div
			bind:this={dialogEl}
			class="modal modal--confirm"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={messageId}
			tabindex="-1"
		>
			<header class="modal__header">
				<h2 id={titleId}>{title}</h2>
				<CloseButton disabled={busy} onclick={() => oncancel?.()} />
			</header>

			<p id={messageId} class="modal__hint">{message}</p>

			{#if error}
				<p class="form-error" role="alert">{error}</p>
			{/if}

			<form class="modal__form" onsubmit={handleSubmit}>
				<footer class="modal__footer">
					<button type="button" class="btn-secondary" onclick={() => oncancel?.()} disabled={busy}>
						{cancelLabel}
					</button>
					<button
						type="submit"
						class={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
						disabled={busy}
					>
						{busy ? busyLabel : confirmLabel}
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}
