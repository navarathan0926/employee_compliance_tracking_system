import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ComplianceStatus } from '../enums/compliance-status.enum';

const VALID_STATUSES = new Set<string>(Object.values(ComplianceStatus));

@ValidatorConstraint({ name: 'complianceStatusFilter', async: false })
export class ComplianceStatusFilterConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return false;
    }

    return parts.every((part) => VALID_STATUSES.has(part));
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be comma-separated values from: ${Object.values(ComplianceStatus).join(', ')}`;
  }
}
