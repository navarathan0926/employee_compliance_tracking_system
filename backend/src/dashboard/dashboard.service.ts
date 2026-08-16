import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceConfigService } from '../common/compliance-config.service';
import { resolvePagination } from '../common/dto/pagination-query.dto';
import { addDaysToDateString, getTodayInTimezone } from '../common/date.util';
import { ComplianceStatus } from '../common/enums/compliance-status.enum';
import { ComplianceRecord } from '../compliance/compliance-records/compliance-record.entity';
import {
  ExpiringQueryDto,
  ExpiringRecordRow,
  ExpiringResponse,
} from './dto/expiring-query.dto';
import {
  DepartmentBreakdownRow,
  MetricsQueryDto,
  MetricsResponse,
  MetricsTotals,
  TypeBreakdownRow,
} from './dto/metrics-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ComplianceRecord)
    private readonly complianceRecordsRepository: Repository<ComplianceRecord>,
    private readonly complianceConfig: ComplianceConfigService,
  ) {}

  private getToday(): string {
    return getTodayInTimezone(this.complianceConfig.timezone);
  }

  private emptyTotals(): MetricsTotals {
    return { active: 0, expiring: 0, expired: 0 };
  }

  private mapDepartmentCounts(
    rows: Array<{ key: string; status: ComplianceStatus; count: string }>,
  ): DepartmentBreakdownRow[] {
    const grouped = new Map<string, MetricsTotals>();

    for (const row of rows) {
      const totals = grouped.get(row.key) ?? this.emptyTotals();
      if (row.status === ComplianceStatus.ACTIVE) {
        totals.active = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRING) {
        totals.expiring = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRED) {
        totals.expired = Number(row.count);
      }
      grouped.set(row.key, totals);
    }

    return Array.from(grouped.entries()).map(([department, totals]) => ({
      department,
      ...totals,
    }));
  }

  private mapTypeCounts(
    rows: Array<{ key: string; status: ComplianceStatus; count: string }>,
  ): TypeBreakdownRow[] {
    const grouped = new Map<string, MetricsTotals>();

    for (const row of rows) {
      const totals = grouped.get(row.key) ?? this.emptyTotals();
      if (row.status === ComplianceStatus.ACTIVE) {
        totals.active = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRING) {
        totals.expiring = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRED) {
        totals.expired = Number(row.count);
      }
      grouped.set(row.key, totals);
    }

    return Array.from(grouped.entries()).map(([type, totals]) => ({
      type,
      ...totals,
    }));
  }

  async getMetrics(query: MetricsQueryDto): Promise<MetricsResponse> {
    const baseQb = this.complianceRecordsRepository
      .createQueryBuilder('record')
      .where('record.deletedAt IS NULL')
      .andWhere('record.status IN (:...statuses)', {
        statuses: [
          ComplianceStatus.ACTIVE,
          ComplianceStatus.EXPIRING,
          ComplianceStatus.EXPIRED,
        ],
      });

    const totalsRows = await baseQb
      .clone()
      .select('record.status', 'status')
      .addSelect('COUNT(record.id)', 'count')
      .groupBy('record.status')
      .getRawMany<{ status: ComplianceStatus; count: string }>();

    const totals = this.emptyTotals();
    for (const row of totalsRows) {
      if (row.status === ComplianceStatus.ACTIVE) {
        totals.active = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRING) {
        totals.expiring = Number(row.count);
      } else if (row.status === ComplianceStatus.EXPIRED) {
        totals.expired = Number(row.count);
      }
    }

    const response: MetricsResponse = { totals };

    if (query.departmentBreakdown) {
      const departmentRows = await baseQb
        .clone()
        .innerJoin('record.employee', 'employee')
        .select('employee.department', 'key')
        .addSelect('record.status', 'status')
        .addSelect('COUNT(record.id)', 'count')
        .groupBy('employee.department')
        .addGroupBy('record.status')
        .getRawMany<{ key: string; status: ComplianceStatus; count: string }>();

      response.byDepartment = this.mapDepartmentCounts(departmentRows);
    }

    if (query.typeBreakdown) {
      const typeRows = await baseQb
        .clone()
        .select('record.type', 'key')
        .addSelect('record.status', 'status')
        .addSelect('COUNT(record.id)', 'count')
        .groupBy('record.type')
        .addGroupBy('record.status')
        .getRawMany<{ key: string; status: ComplianceStatus; count: string }>();

      response.byType = this.mapTypeCounts(typeRows);
    }

    return response;
  }

  async getExpiring(query: ExpiringQueryDto): Promise<ExpiringResponse> {
    const { limit, offset } = resolvePagination(query);
    let from: string;
    let to: string;

    if (query.from || query.to) {
      if (!query.from || !query.to) {
        throw new BadRequestException(
          'Both from and to are required for a custom date range',
        );
      }
      from = query.from;
      to = query.to;
    } else {
      from = this.getToday();
      to = addDaysToDateString(from, query.days ?? 30);
    }

    const qb = this.complianceRecordsRepository
      .createQueryBuilder('record')
      .innerJoin('record.employee', 'employee')
      .select([
        'record.id',
        'record.employeeId',
        'record.type',
        'record.issuedDate',
        'record.expiryDate',
        'record.status',
        'record.notes',
      ])
      .addSelect(['employee.name', 'employee.department'])
      .where('record.deletedAt IS NULL')
      .andWhere('record.status IN (:...statuses)', {
        statuses: [
          ComplianceStatus.ACTIVE,
          ComplianceStatus.EXPIRING,
          ComplianceStatus.EXPIRED,
        ],
      })
      .andWhere('record.expiryDate >= :from', { from })
      .andWhere('record.expiryDate <= :to', { to })
      .orderBy('record.expiryDate', 'ASC')
      .addOrderBy('record.id', 'ASC')
      .skip(offset)
      .take(limit);

    const [records, total] = await qb.getManyAndCount();

    const data: ExpiringRecordRow[] = records.map((record) => ({
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employee.name,
      department: record.employee.department,
      type: record.type,
      issuedDate: record.issuedDate,
      expiryDate: record.expiryDate,
      status: record.status,
      notes: record.notes,
    }));

    return { data, total, limit, offset, from, to };
  }
}
