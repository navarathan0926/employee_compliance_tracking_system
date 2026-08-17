import {
  ComplianceStatus,
  EvaluableComplianceStatus,
} from './enums/compliance-status.enum';
import { addDaysToDateString } from './date.util';

export function computeComplianceStatus(
  expiryDate: string,
  today: string,
  bufferDays: number,
): EvaluableComplianceStatus {
  if (expiryDate < today) {
    return ComplianceStatus.EXPIRED;
  }

  const expiringThreshold = addDaysToDateString(today, bufferDays);
  if (expiryDate <= expiringThreshold) {
    return ComplianceStatus.EXPIRING;
  }

  return ComplianceStatus.ACTIVE;
}
