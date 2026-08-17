export enum ComplianceStatus {
  ACTIVE = 'active',
  EXPIRING = 'expiring',
  EXPIRED = 'expired',
  RENEWED = 'renewed',
  ARCHIVED = 'archived',
}

export const EVALUABLE_STATUSES = [
  ComplianceStatus.ACTIVE,
  ComplianceStatus.EXPIRING,
  ComplianceStatus.EXPIRED,
] as const;

export type EvaluableComplianceStatus = (typeof EVALUABLE_STATUSES)[number];

export const BULK_UPDATE_STATUSES = EVALUABLE_STATUSES;
