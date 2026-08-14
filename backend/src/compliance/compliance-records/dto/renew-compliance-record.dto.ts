import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Validate } from 'class-validator';
import { ExpiryAfterIssuedConstraint } from './create-compliance-record.dto';

export class RenewComplianceRecordDto {
  @ApiProperty({ format: 'date', example: '2026-08-01' })
  @IsDateString()
  issuedDate!: string;

  @ApiProperty({
    format: 'date',
    example: '2027-08-01',
    description: 'Must be after issuedDate',
  })
  @IsDateString()
  @Validate(ExpiryAfterIssuedConstraint)
  expiryDate!: string;

  @ApiPropertyOptional({ example: 'Renewed visa' })
  @IsOptional()
  @IsString()
  notes?: string;
}
