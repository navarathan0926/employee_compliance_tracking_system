import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateComplianceRecordDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-01-15',
    description: 'Correcting issuedDate recalculates status',
  })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2027-06-01',
    description: 'Correcting expiryDate recalculates status',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
