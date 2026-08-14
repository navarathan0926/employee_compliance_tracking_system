import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceConfigService } from '../../common/compliance-config.service';
import { Employee } from '../employees/employee.entity';
import { ComplianceRecordController } from './compliance-record.controller';
import { ComplianceRecord } from './compliance-record.entity';
import { ComplianceRecordService } from './compliance-record.service';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceRecord, Employee])],
  controllers: [ComplianceRecordController],
  providers: [ComplianceRecordService, ComplianceConfigService],
  exports: [ComplianceRecordService],
})
export class ComplianceRecordsModule {}
