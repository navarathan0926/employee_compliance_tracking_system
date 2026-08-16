import { describe, expect, it } from 'vitest';
import {
	buildComplianceRecordsQueryParams,
	buildExpiringQueryParams,
	buildMetricsQueryParams,
	isValidCustomRange
} from './query';

describe('query', () => {
	it('builds preset expiring query params', () => {
		const params = buildExpiringQueryParams({ mode: 'preset', days: 30 }, { limit: 50, offset: 0 });

		expect(params.get('days')).toBe('30');
		expect(params.get('limit')).toBe('50');
		expect(params.get('offset')).toBe('0');
		expect(params.has('from')).toBe(false);
		expect(params.has('to')).toBe(false);
	});

	it('builds custom expiring query params without days', () => {
		const params = buildExpiringQueryParams(
			{ mode: 'custom', from: '2026-08-01', to: '2026-08-31' },
			{ limit: 25, offset: 50 }
		);

		expect(params.get('from')).toBe('2026-08-01');
		expect(params.get('to')).toBe('2026-08-31');
		expect(params.has('days')).toBe(false);
		expect(params.get('limit')).toBe('25');
		expect(params.get('offset')).toBe('50');
	});

	it('builds metrics breakdown query params', () => {
		const params = buildMetricsQueryParams({
			departmentBreakdown: true,
			typeBreakdown: false
		});

		expect(params.get('departmentBreakdown')).toBe('true');
		expect(params.has('typeBreakdown')).toBe(false);
	});

	it('validates custom date ranges', () => {
		expect(isValidCustomRange('2026-08-01', '2026-08-31')).toBe(true);
		expect(isValidCustomRange('2026-08-31', '2026-08-01')).toBe(false);
		expect(isValidCustomRange('', '2026-08-01')).toBe(false);
	});

	it('builds compliance records query params', () => {
		const params = buildComplianceRecordsQueryParams({
			employeeId: 3,
			status: 'active,expiring',
			type: 'visa',
			expiryFrom: '2026-08-01',
			expiryTo: '2026-08-31',
			limit: 25,
			offset: 50
		});

		expect(params.get('employeeId')).toBe('3');
		expect(params.get('status')).toBe('active,expiring');
		expect(params.get('type')).toBe('visa');
		expect(params.get('expiryFrom')).toBe('2026-08-01');
		expect(params.get('expiryTo')).toBe('2026-08-31');
		expect(params.get('limit')).toBe('25');
		expect(params.get('offset')).toBe('50');
	});
});
