<script lang="ts">
	import CloseButton from '$lib/components/CloseButton.svelte';
	import { dismiss, toastState, type ToastVariant } from '$lib/toast.svelte';

	function iconPath(variant: ToastVariant): string {
		if (variant === 'error') {
			return 'M8 3.2v6.1M8 12.2h.01';
		}

		return 'M4.2 8.2 6.8 10.8 11.8 5.4';
	}
</script>

<div class="toast-viewport" aria-live="polite" aria-relevant="additions">
	{#each toastState.items as toast (toast.id)}
		<div class="toast toast--{toast.variant}" role={toast.variant === 'error' ? 'alert' : 'status'}>
			<span class="toast__icon" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16">
					<path
						d={iconPath(toast.variant)}
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
			<p class="toast__message">{toast.message}</p>
			<CloseButton onclick={() => dismiss(toast.id)} />
		</div>
	{/each}
</div>
