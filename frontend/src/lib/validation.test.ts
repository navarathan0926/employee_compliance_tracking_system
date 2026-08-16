import { describe, expect, it } from 'vitest';
import {
	hasFieldErrors,
	isExpiryAfterIssued,
	validateCreateComplianceRecord,
	validateRenewComplianceRecord,
	validateUpdateComplianceRecord
} from './validation';

describe('validation', () => {
	it('checks expiry is after issued date', () => {
		expect(isExpiryAfterIssued('2026-01-01', '2026-01-02')).toBe(true);
		expect(isExpiryAfterIssued('2026-01-02', '2026-01-01')).toBe(false);
		expect(isExpiryAfterIssued('2026-01-01', '2026-01-01')).toBe(false);
	});

	it('validates create payload required fields', () => {
		const errors = validateCreateComplianceRecord({
			employeeId: 0,
			type: 'visa',
			issuedDate: '',
			expiryDate: ''
		});

		expect(errors.employeeId).toBeTruthy();
		expect(errors.issuedDate).toBeTruthy();
		expect(errors.expiryDate).toBeTruthy();
		expect(hasFieldErrors(errors)).toBe(true);
	});

	it('validates create payload date ordering', () => {
		const errors = validateCreateComplianceRecord({
			employeeId: 1,
			type: 'visa',
			issuedDate: '2026-08-15',
			expiryDate: '2026-08-14'
		});

		expect(errors.expiryDate).toBe('Expiry date must be after issued date.');
	});

	it('validates update payload against current dates', () => {
		const errors = validateUpdateComplianceRecord(
			{ expiryDate: '2026-01-01' },
			{ issuedDate: '2026-01-15', expiryDate: '2026-12-31' }
		);

		expect(errors.expiryDate).toBe('Expiry date must be after issued date.');
	});

	it('validates renew payload', () => {
		const errors = validateRenewComplianceRecord({
			issuedDate: '2026-08-01',
			expiryDate: '2027-08-01'
		});

		expect(hasFieldErrors(errors)).toBe(false);
	});
});
