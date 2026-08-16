const DISPLAY_DATE = new Intl.DateTimeFormat(undefined, {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

export function formatDate(isoDate: string): string {
	const [year, month, day] = isoDate.split('-').map(Number);
	const date = new Date(year, month - 1, day);

	return DISPLAY_DATE.format(date);
}

export function formatComplianceType(type: string): string {
	return type.replace(/_/g, ' ');
}

export function formatStatusLabel(status: string): string {
	return status.replace(/_/g, ' ');
}
