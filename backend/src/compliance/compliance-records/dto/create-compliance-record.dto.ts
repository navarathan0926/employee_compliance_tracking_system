import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ComplianceType } from '../../../common/enums/compliance-type.enum';

@ValidatorConstraint({ name: 'expiryAfterIssued', async: false })
export class ExpiryAfterIssuedConstraint implements ValidatorConstraintInterface {
  validate(expiryDate: string, args: ValidationArguments): boolean {
    const object = args.object as { issuedDate?: string };
    if (!object.issuedDate || !expiryDate) {
      return true;
    }
    return expiryDate > object.issuedDate;
  }

  defaultMessage(): string {
    return 'expiryDate must be after issuedDate';
  }
}

export class CreateComplianceRecordDto {
  @ApiProperty({ example: 1, description: 'Non-archived employee ID' })
  @Type(() => Number)
  @IsInt()
  employeeId!: number;

  @ApiProperty({
    enum: ComplianceType,
    example: ComplianceType.VISA,
    description: 'Compliance item type',
  })
  @IsEnum(ComplianceType)
  type!: ComplianceType;

  @ApiProperty({
    format: 'date',
    example: '2026-01-15',
    description: 'Calendar date (YYYY-MM-DD)',
  })
  @IsDateString()
  issuedDate!: string;

  @ApiProperty({
    format: 'date',
    example: '2027-01-15',
    description: 'Must be after issuedDate; status is computed server-side',
  })
  @IsDateString()
  @Validate(ExpiryAfterIssuedConstraint)
  expiryDate!: string;

  @ApiPropertyOptional({ example: 'Work visa renewal notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
