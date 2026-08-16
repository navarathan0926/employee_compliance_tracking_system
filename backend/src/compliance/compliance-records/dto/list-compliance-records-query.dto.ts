import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ComplianceStatus } from '../../../common/enums/compliance-status.enum';
import { ComplianceType } from '../../../common/enums/compliance-type.enum';
import { ComplianceStatusFilterConstraint } from '../../../common/validators/compliance-status-filter.constraint';

export class ListComplianceRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @ApiPropertyOptional({
    example: 'active,expiring',
    description:
      'Comma-separated: active, expiring, expired, renewed, archived',
  })
  @IsOptional()
  @IsString()
  @Validate(ComplianceStatusFilterConstraint)
  status?: string;

  @ApiPropertyOptional({ enum: ComplianceType, example: ComplianceType.VISA })
  @IsOptional()
  @IsEnum(ComplianceType)
  type?: ComplianceType;

  @ApiPropertyOptional({ format: 'date', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  expiryFrom?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiryTo?: string;
}

export function parseStatusFilter(status?: string): ComplianceStatus[] | undefined {
  if (!status) {
    return undefined;
  }

  return status
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as ComplianceStatus[];
}

export function statusFilterIncludesDeletedStatuses(
  statuses?: ComplianceStatus[],
): boolean {
  if (!statuses?.length) {
    return false;
  }

  return statuses.some(
    (value) =>
      value === ComplianceStatus.RENEWED || value === ComplianceStatus.ARCHIVED,
  );
}
