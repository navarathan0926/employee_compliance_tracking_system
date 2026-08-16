import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

function toBoolean(value: unknown): boolean {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  return false;
}

export class MetricsQueryDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Include per-department status counts',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  departmentBreakdown?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Include per-type status counts',
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  typeBreakdown?: boolean;
}

export interface MetricsTotals {
  active: number;
  expiring: number;
  expired: number;
}

export interface DepartmentBreakdownRow extends MetricsTotals {
  department: string;
}

export interface TypeBreakdownRow extends MetricsTotals {
  type: string;
}

export interface MetricsResponse {
  totals: MetricsTotals;
  byDepartment?: DepartmentBreakdownRow[];
  byType?: TypeBreakdownRow[];
}
