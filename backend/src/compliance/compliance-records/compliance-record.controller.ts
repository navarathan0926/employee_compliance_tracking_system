import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { ComplianceRecordService } from './compliance-record.service';
import { BulkStatusUpdateDto } from './dto/bulk-status-update.dto';
import { CreateComplianceRecordDto } from './dto/create-compliance-record.dto';
import { ListComplianceRecordsQueryDto } from './dto/list-compliance-records-query.dto';
import { RenewComplianceRecordDto } from './dto/renew-compliance-record.dto';
import { UpdateComplianceRecordDto } from './dto/update-compliance-record.dto';

@ApiTags('Compliance Records')
@ApiBearerAuth('JWT-auth')
@Controller('compliance-records')
export class ComplianceRecordController {
  constructor(
    private readonly complianceRecordService: ComplianceRecordService,
  ) {}

  @Post()
  @ApiBody({ type: CreateComplianceRecordDto })
  create(@Body() dto: CreateComplianceRecordDto) {
    return this.complianceRecordService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListComplianceRecordsQueryDto) {
    return this.complianceRecordService.findAll(query);
  }

  @Patch('bulk-status')
  @ApiBody({ type: BulkStatusUpdateDto })
  bulkStatusUpdate(@Body() dto: BulkStatusUpdateDto) {
    return this.complianceRecordService.bulkStatusUpdate(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.complianceRecordService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateComplianceRecordDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComplianceRecordDto,
  ) {
    return this.complianceRecordService.update(id, dto);
  }

  @Post(':id/renew')
  @ApiBody({ type: RenewComplianceRecordDto })
  renew(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenewComplianceRecordDto,
  ) {
    return this.complianceRecordService.renew(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Compliance record archived' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.complianceRecordService.archive(id);
  }
}
