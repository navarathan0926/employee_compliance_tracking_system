export type ComplianceStatus = 'active' | 'expiring' | 'expired' | 'renewed' | 'archived';

export type ComplianceType = 'visa' | 'certification' | 'background_check' | 'training' | 'other';

export const COMPLIANCE_TYPES: ComplianceType[] = [
	'visa',
	'certification',
	'background_check',
	'training',
	'other'
];

export const EDITABLE_COMPLIANCE_STATUSES: ComplianceStatus[] = ['active', 'expiring', 'expired'];

export interface Employee {
	id: number;
	name: string;
	department: string;
}

export interface ComplianceRecord {
	id: number;
	employeeId: number;
	type: ComplianceType;
	issuedDate: string;
	expiryDate: string;
	status: ComplianceStatus;
	renewedFromId: number | null;
	notes: string | null;
	createdAt?: string;
	updatedAt?: string;
	employee?: Employee;
}

export interface CreateComplianceRecordPayload {
	employeeId: number;
	type: ComplianceType;
	issuedDate: string;
	expiryDate: string;
	notes?: string;
}

export interface UpdateComplianceRecordPayload {
	issuedDate?: string;
	expiryDate?: string;
	notes?: string;
}

export interface RenewComplianceRecordPayload {
	issuedDate: string;
	expiryDate: string;
	notes?: string;
}

export interface ComplianceRecordsQueryOptions {
	employeeId?: number;
	status?: string;
	type?: ComplianceType;
	expiryFrom?: string;
	expiryTo?: string;
	limit?: number;
	offset?: number;
}

export interface MetricsTotals {
	active: number;
	expiring: number;
	expired: number;
}

export interface DepartmentBreakdownRow extends MetricsTotals {
	department: string;
}

export interface TypeBreakdownRow extends MetricsTotals {
	type: ComplianceType | string;
}

export interface MetricsResponse {
	totals: MetricsTotals;
	byDepartment?: DepartmentBreakdownRow[];
	byType?: TypeBreakdownRow[];
}

export interface ExpiringRecord {
	id: number;
	employeeId: number;
	employeeName: string;
	department: string;
	type: ComplianceType | string;
	issuedDate: string;
	expiryDate: string;
	status: ComplianceStatus;
	notes: string | null;
}

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	limit: number;
	offset: number;
}

export interface ExpiringResponse extends PaginatedResponse<ExpiringRecord> {
	from: string;
	to: string;
}

export interface LoginResponse {
	accessToken: string;
}

export type ExpiringFilterChange =
	{ mode: 'preset'; days: number } | { mode: 'custom'; from: string; to: string };

export interface MetricsQueryOptions {
	departmentBreakdown?: boolean;
	typeBreakdown?: boolean;
}

export interface ExpiringQueryOptions {
	days?: number;
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
}
