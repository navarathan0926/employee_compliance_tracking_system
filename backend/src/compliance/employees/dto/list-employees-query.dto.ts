import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListEmployeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Engineering',
    description: 'Filter by department',
  })
  @IsOptional()
  @IsString()
  department?: string;
}
