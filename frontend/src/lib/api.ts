import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { browser } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { clearToken, getToken } from './auth';
import {
	buildComplianceRecordsQueryParams,
	buildExpiringQueryParams,
	buildMetricsQueryParams
} from './query';
import type {
	ComplianceRecord,
	ComplianceRecordsQueryOptions,
	CreateComplianceRecordPayload,
	Employee,
	ExpiringFilterChange,
	ExpiringQueryOptions,
	ExpiringResponse,
	LoginResponse,
	MetricsQueryOptions,
	MetricsResponse,
	PaginatedResponse,
	RenewComplianceRecordPayload,
	UpdateComplianceRecordPayload
} from './types';

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

async function parseErrorMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { message?: string | string[] };
		if (Array.isArray(body.message)) {
			return body.message.join(', ');
		}
		if (body.message) {
			return body.message;
		}
	} catch {
		// Fall through to status text.
	}

	return response.statusText || 'Request failed';
}

async function apiFetch<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
	const headers = new Headers(options.headers);

	if (options.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	if (auth) {
		const token = getToken();
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
	}

	const response = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
		...options,
		headers
	});

	if (response.status === 401) {
		clearToken();
		if (browser) {
			await goto(resolve('/login'));
		}
		throw new ApiError(401, 'Unauthorized');
	}

	if (!response.ok) {
		const message = await parseErrorMessage(response);
		throw new ApiError(response.status, message);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
	return apiFetch<LoginResponse>(
		'/auth/login',
		{
			method: 'POST',
			body: JSON.stringify({ username, password })
		},
		false
	);
}

export async function getMetrics(options: MetricsQueryOptions = {}): Promise<MetricsResponse> {
	const params = buildMetricsQueryParams(options);
	const query = params.toString();
	const path = query ? `/dashboard/metrics?${query}` : '/dashboard/metrics';

	return apiFetch<MetricsResponse>(path);
}

export async function getExpiring(
	filter: ExpiringFilterChange,
	pagination: Pick<ExpiringQueryOptions, 'limit' | 'offset'> = {}
): Promise<ExpiringResponse> {
	const params = buildExpiringQueryParams(filter, pagination);
	return apiFetch<ExpiringResponse>(`/dashboard/expiring?${params.toString()}`);
}

export async function listEmployees(
	options: { limit?: number; offset?: number; department?: string } = {}
): Promise<PaginatedResponse<Employee>> {
	const params = new URLSearchParams();
	params.set('limit', String(options.limit ?? 200));
	params.set('offset', String(options.offset ?? 0));

	if (options.department) {
		params.set('department', options.department);
	}

	return apiFetch<PaginatedResponse<Employee>>(`/employees?${params.toString()}`);
}

export async function listComplianceRecords(
	options: ComplianceRecordsQueryOptions = {}
): Promise<PaginatedResponse<ComplianceRecord>> {
	const params = buildComplianceRecordsQueryParams(options);
	return apiFetch<PaginatedResponse<ComplianceRecord>>(`/compliance-records?${params.toString()}`);
}

export async function getComplianceRecord(id: number): Promise<ComplianceRecord> {
	return apiFetch<ComplianceRecord>(`/compliance-records/${id}`);
}

export async function createComplianceRecord(
	payload: CreateComplianceRecordPayload
): Promise<ComplianceRecord> {
	return apiFetch<ComplianceRecord>('/compliance-records', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateComplianceRecord(
	id: number,
	payload: UpdateComplianceRecordPayload
): Promise<ComplianceRecord> {
	return apiFetch<ComplianceRecord>(`/compliance-records/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function renewComplianceRecord(
	id: number,
	payload: RenewComplianceRecordPayload
): Promise<ComplianceRecord> {
	return apiFetch<ComplianceRecord>(`/compliance-records/${id}/renew`, {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function archiveComplianceRecord(id: number): Promise<void> {
	return apiFetch<void>(`/compliance-records/${id}`, {
		method: 'DELETE'
	});
}
