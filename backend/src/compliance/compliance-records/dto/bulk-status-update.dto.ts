import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { MAX_PAGE_LIMIT } from '../../../common/dto/pagination-query.dto';
import {
  BULK_UPDATE_STATUSES,
  ComplianceStatus,
} from '../../../common/enums/compliance-status.enum';

export class BulkStatusUpdateItemDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  id!: number;

  @ApiProperty({
    enum: BULK_UPDATE_STATUSES,
    example: ComplianceStatus.EXPIRING,
    description: 'Only active, expiring, or expired',
  })
  @IsIn(BULK_UPDATE_STATUSES)
  newStatus!: ComplianceStatus;
}

export class BulkStatusUpdateDto {
  @ApiProperty({
    type: [BulkStatusUpdateItemDto],
    example: [
      { id: 101, newStatus: 'expiring' },
      { id: 205, newStatus: 'expired' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PAGE_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => BulkStatusUpdateItemDto)
  updates!: BulkStatusUpdateItemDto[];
}
