import { Module } from '@nestjs/common';
import { ComplianceRecordsModule } from './compliance-records/compliance-records.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [EmployeesModule, ComplianceRecordsModule],
  exports: [EmployeesModule, ComplianceRecordsModule],
})
export class ComplianceModule {}
