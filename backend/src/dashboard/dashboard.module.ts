import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceConfigService } from '../common/compliance-config.service';
import { ComplianceRecord } from '../compliance/compliance-records/compliance-record.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceRecord])],
  controllers: [DashboardController],
  providers: [DashboardService, ComplianceConfigService],
})
export class DashboardModule {}
