import { ComplianceStatus } from './enums/compliance-status.enum';
import { computeComplianceStatus } from './compliance-status.util';

describe('computeComplianceStatus', () => {
  const today = '2026-08-14';
  const bufferDays = 30;

  it('returns expired when expiryDate is before today', () => {
    expect(computeComplianceStatus('2026-08-13', today, bufferDays)).toBe(
      ComplianceStatus.EXPIRED,
    );
  });

  it('returns expiring when expiryDate is within the buffer window', () => {
    expect(computeComplianceStatus('2026-08-14', today, bufferDays)).toBe(
      ComplianceStatus.EXPIRING,
    );
    expect(computeComplianceStatus('2026-09-13', today, bufferDays)).toBe(
      ComplianceStatus.EXPIRING,
    );
  });

  it('returns active when expiryDate is beyond the buffer window', () => {
    expect(computeComplianceStatus('2026-09-14', today, bufferDays)).toBe(
      ComplianceStatus.ACTIVE,
    );
  });

  it('handles string buffer days without string concatenation in date math', () => {
    expect(
      computeComplianceStatus('2027-08-01', today, '30' as unknown as number),
    ).toBe(ComplianceStatus.ACTIVE);
  });

  it('supports rare active to expired transitions via date rule', () => {
    expect(computeComplianceStatus('2026-01-01', today, bufferDays)).toBe(
      ComplianceStatus.EXPIRED,
    );
  });
});
