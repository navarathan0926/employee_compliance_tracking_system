export type ToastVariant = 'success' | 'error';

export interface ToastItem {
	id: number;
	message: string;
	variant: ToastVariant;
}

const MAX_TOASTS = 4;
const DEFAULT_DURATION_MS = 4500;

let nextId = 0;

export const toastState = $state<{ items: ToastItem[] }>({
	items: []
});

export function notify(message: string, variant: ToastVariant = 'success'): number {
	const id = ++nextId;

	toastState.items = [...toastState.items, { id, message, variant }].slice(-MAX_TOASTS);

	if (typeof window !== 'undefined') {
		window.setTimeout(() => dismiss(id), DEFAULT_DURATION_MS);
	}

	return id;
}

export function dismiss(id: number): void {
	toastState.items = toastState.items.filter((item) => item.id !== id);
}
