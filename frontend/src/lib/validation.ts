import type {
	CreateComplianceRecordPayload,
	RenewComplianceRecordPayload,
	UpdateComplianceRecordPayload
} from './types';

export interface ComplianceFieldErrors {
	employeeId?: string;
	type?: string;
	issuedDate?: string;
	expiryDate?: string;
	notes?: string;
}

export function isExpiryAfterIssued(issuedDate: string, expiryDate: string): boolean {
	if (!issuedDate || !expiryDate) {
		return false;
	}

	return expiryDate > issuedDate;
}

export function validateComplianceDates(
	issuedDate: string,
	expiryDate: string
): Pick<ComplianceFieldErrors, 'issuedDate' | 'expiryDate'> {
	const errors: Pick<ComplianceFieldErrors, 'issuedDate' | 'expiryDate'> = {};

	if (!issuedDate) {
		errors.issuedDate = 'Issued date is required.';
	}

	if (!expiryDate) {
		errors.expiryDate = 'Expiry date is required.';
	}

	if (issuedDate && expiryDate && !isExpiryAfterIssued(issuedDate, expiryDate)) {
		errors.expiryDate = 'Expiry date must be after issued date.';
	}

	return errors;
}

export function validateCreateComplianceRecord(
	payload: CreateComplianceRecordPayload
): ComplianceFieldErrors {
	const errors: ComplianceFieldErrors = {};

	if (!payload.employeeId || payload.employeeId <= 0) {
		errors.employeeId = 'Employee is required.';
	}

	if (!payload.type) {
		errors.type = 'Compliance type is required.';
	}

	Object.assign(errors, validateComplianceDates(payload.issuedDate, payload.expiryDate));

	return errors;
}

export function validateUpdateComplianceRecord(
	payload: UpdateComplianceRecordPayload,
	current: { issuedDate: string; expiryDate: string }
): ComplianceFieldErrors {
	const issuedDate = payload.issuedDate ?? current.issuedDate;
	const expiryDate = payload.expiryDate ?? current.expiryDate;

	return validateComplianceDates(issuedDate, expiryDate);
}

export function validateRenewComplianceRecord(
	payload: RenewComplianceRecordPayload
): ComplianceFieldErrors {
	return validateComplianceDates(payload.issuedDate, payload.expiryDate);
}

export function hasFieldErrors(errors: ComplianceFieldErrors): boolean {
	return Object.keys(errors).length > 0;
}
