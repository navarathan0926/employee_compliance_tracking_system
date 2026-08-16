import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ExpiringQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: 30,
    minimum: 1,
    example: 30,
    description: 'Window from today (Asia/Colombo); ignored if from/to set',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-14',
    description: 'Custom range start (requires to)',
  })
  @ValidateIf((query: ExpiringQueryDto) => Boolean(query.from || query.to))
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-09-13',
    description: 'Custom range end (requires from)',
  })
  @ValidateIf((query: ExpiringQueryDto) => Boolean(query.from || query.to))
  @IsDateString()
  to?: string;
}

export interface ExpiringRecordRow {
  id: number;
  employeeId: number;
  employeeName: string;
  department: string;
  type: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  notes: string | null;
}

export interface ExpiringResponse {
  data: ExpiringRecordRow[];
  total: number;
  limit: number;
  offset: number;
  from: string;
  to: string;
}
