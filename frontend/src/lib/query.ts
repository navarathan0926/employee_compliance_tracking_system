import type {
	ComplianceRecordsQueryOptions,
	ExpiringFilterChange,
	ExpiringQueryOptions
} from './types';

export const DEFAULT_EXPIRING_DAYS = 30;
export const DEFAULT_PAGE_LIMIT = 50;

export function buildExpiringQueryParams(
	filter: ExpiringFilterChange,
	pagination: Pick<ExpiringQueryOptions, 'limit' | 'offset'> = {}
): URLSearchParams {
	const params = new URLSearchParams();
	const limit = pagination.limit ?? DEFAULT_PAGE_LIMIT;
	const offset = pagination.offset ?? 0;

	params.set('limit', String(limit));
	params.set('offset', String(offset));

	if (filter.mode === 'custom') {
		params.set('from', filter.from);
		params.set('to', filter.to);
		return params;
	}

	params.set('days', String(filter.days));
	return params;
}

export function buildMetricsQueryParams(options: {
	departmentBreakdown?: boolean;
	typeBreakdown?: boolean;
}): URLSearchParams {
	const params = new URLSearchParams();

	if (options.departmentBreakdown) {
		params.set('departmentBreakdown', 'true');
	}

	if (options.typeBreakdown) {
		params.set('typeBreakdown', 'true');
	}

	return params;
}

export function buildComplianceRecordsQueryParams(
	options: ComplianceRecordsQueryOptions = {}
): URLSearchParams {
	const params = new URLSearchParams();

	params.set('limit', String(options.limit ?? DEFAULT_PAGE_LIMIT));
	params.set('offset', String(options.offset ?? 0));

	if (options.employeeId) {
		params.set('employeeId', String(options.employeeId));
	}

	if (options.status) {
		params.set('status', options.status);
	}

	if (options.type) {
		params.set('type', options.type);
	}

	if (options.expiryFrom) {
		params.set('expiryFrom', options.expiryFrom);
	}

	if (options.expiryTo) {
		params.set('expiryTo', options.expiryTo);
	}

	return params;
}

export function isValidCustomRange(from: string, to: string): boolean {
	if (!from || !to) {
		return false;
	}

	return from <= to;
}
