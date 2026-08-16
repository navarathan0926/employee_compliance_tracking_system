import { describe, expect, it } from 'vitest';
import { formatComplianceType, formatDate, formatStatusLabel } from './format';

describe('format', () => {
	it('formats ISO dates for display', () => {
		expect(formatDate('2026-09-01')).toMatch(/Sep/);
		expect(formatDate('2026-09-01')).toMatch(/2026/);
	});

	it('formats compliance types and status labels', () => {
		expect(formatComplianceType('background_check')).toBe('background check');
		expect(formatStatusLabel('expiring')).toBe('expiring');
	});
});
