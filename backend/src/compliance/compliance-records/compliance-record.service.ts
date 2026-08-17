import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { computeComplianceStatus } from '../../common/compliance-status.util';
import { ComplianceConfigService } from '../../common/compliance-config.service';
import {
  PaginatedResult,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { getTodayInTimezone } from '../../common/date.util';
import {
  ComplianceStatus,
  EvaluableComplianceStatus,
} from '../../common/enums/compliance-status.enum';
import { Employee } from '../employees/employee.entity';
import { BulkStatusUpdateDto } from './dto/bulk-status-update.dto';
import { CreateComplianceRecordDto } from './dto/create-compliance-record.dto';
import {
  ListComplianceRecordsQueryDto,
  parseStatusFilter,
  statusFilterIncludesDeletedStatuses,
} from './dto/list-compliance-records-query.dto';
import { RenewComplianceRecordDto } from './dto/renew-compliance-record.dto';
import { UpdateComplianceRecordDto } from './dto/update-compliance-record.dto';
import { ComplianceRecord } from './compliance-record.entity';

@Injectable()
export class ComplianceRecordService {
  constructor(
    @InjectRepository(ComplianceRecord)
    private readonly complianceRecordsRepository: Repository<ComplianceRecord>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly complianceConfig: ComplianceConfigService,
  ) {}

  private getToday(): string {
    return getTodayInTimezone(this.complianceConfig.timezone);
  }

  private computeStatus(expiryDate: string): EvaluableComplianceStatus {
    return computeComplianceStatus(
      expiryDate,
      this.getToday(),
      this.complianceConfig.bufferDays,
    );
  }

  private assertExpiryAfterIssued(
    issuedDate: string,
    expiryDate: string,
  ): void {
    if (expiryDate <= issuedDate) {
      throw new BadRequestException('expiryDate must be after issuedDate');
    }
  }

  private async assertActiveEmployee(employeeId: number): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new BadRequestException(
        `Employee ${employeeId} not found or archived`,
      );
    }

    return employee;
  }

  async create(dto: CreateComplianceRecordDto): Promise<ComplianceRecord> {
    await this.assertActiveEmployee(dto.employeeId);
    this.assertExpiryAfterIssued(dto.issuedDate, dto.expiryDate);

    const status = this.computeStatus(dto.expiryDate);
    const record = this.complianceRecordsRepository.create({
      ...dto,
      status,
    });

    return this.complianceRecordsRepository.save(record);
  }

  async findAll(
    query: ListComplianceRecordsQueryDto,
  ): Promise<PaginatedResult<ComplianceRecord>> {
    const { limit, offset } = resolvePagination(query);
    const statuses = parseStatusFilter(query.status);
    const includeDeleted = statusFilterIncludesDeletedStatuses(statuses);

    const qb = this.complianceRecordsRepository
      .createQueryBuilder('record')
      .select([
        'record.id',
        'record.employeeId',
        'record.type',
        'record.issuedDate',
        'record.expiryDate',
        'record.status',
        'record.renewedFromId',
        'record.notes',
        'record.createdAt',
        'record.updatedAt',
      ]);

    if (includeDeleted) {
      qb.withDeleted();
    } else {
      qb.andWhere('record.deletedAt IS NULL');
    }

    if (query.employeeId) {
      qb.andWhere('record.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }

    if (statuses?.length) {
      qb.andWhere('record.status IN (:...statuses)', { statuses });
    }

    if (query.type) {
      qb.andWhere('record.type = :type', { type: query.type });
    }

    if (query.expiryFrom) {
      qb.andWhere('record.expiryDate >= :expiryFrom', {
        expiryFrom: query.expiryFrom,
      });
    }

    if (query.expiryTo) {
      qb.andWhere('record.expiryDate <= :expiryTo', {
        expiryTo: query.expiryTo,
      });
    }

    qb.orderBy('record.id', 'ASC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, limit, offset };
  }

  async findOne(id: number): Promise<ComplianceRecord> {
    const record = await this.complianceRecordsRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: ['employee'],
    });

    if (!record) {
      throw new NotFoundException(`Compliance record ${id} not found`);
    }

    return record;
  }

  async update(
    id: number,
    dto: UpdateComplianceRecordDto,
  ): Promise<ComplianceRecord> {
    const record = await this.findOne(id);

    if (
      record.status === ComplianceStatus.RENEWED ||
      record.status === ComplianceStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Cannot update a renewed or archived compliance record',
      );
    }

    const issuedDate = dto.issuedDate ?? record.issuedDate;
    const expiryDate = dto.expiryDate ?? record.expiryDate;

    if (dto.issuedDate !== undefined || dto.expiryDate !== undefined) {
      this.assertExpiryAfterIssued(issuedDate, expiryDate);
      record.issuedDate = issuedDate;
      record.expiryDate = expiryDate;

      const status = this.computeStatus(expiryDate);
      record.status = status;
    }

    if (dto.notes !== undefined) {
      record.notes = dto.notes;
    }

    return this.complianceRecordsRepository.save(record);
  }

  async renew(
    id: number,
    dto: RenewComplianceRecordDto,
  ): Promise<ComplianceRecord> {
    this.assertExpiryAfterIssued(dto.issuedDate, dto.expiryDate);

    return this.complianceRecordsRepository.manager.transaction(
      async (manager) => {
        const oldRecord = await manager.findOne(ComplianceRecord, {
          where: { id },
        });

        if (!oldRecord) {
          throw new NotFoundException(`Compliance record ${id} not found`);
        }

        if (
          oldRecord.status === ComplianceStatus.RENEWED ||
          oldRecord.status === ComplianceStatus.ARCHIVED
        ) {
          throw new BadRequestException(
            'Compliance record is already renewed or archived',
          );
        }

        const status = this.computeStatus(dto.expiryDate);
        const newRecord = manager.create(ComplianceRecord, {
          employeeId: oldRecord.employeeId,
          type: oldRecord.type,
          issuedDate: dto.issuedDate,
          expiryDate: dto.expiryDate,
          notes: dto.notes ?? null,
          renewedFromId: oldRecord.id,
          status,
        });

        const savedNewRecord = await manager.save(newRecord);

        oldRecord.status = ComplianceStatus.RENEWED;
        await manager.save(oldRecord);
        await manager.softDelete(ComplianceRecord, oldRecord.id);

        return savedNewRecord;
      },
    );
  }

  async bulkStatusUpdate(
    dto: BulkStatusUpdateDto,
  ): Promise<{ processed: number }> {
    const ids = dto.updates.map((update) => update.id);
    const records = await this.complianceRecordsRepository.find({
      where: { id: In(ids) },
      withDeleted: true,
      select: ['id', 'status', 'deletedAt'],
    });
    const recordMap = new Map(records.map((record) => [record.id, record]));

    const updatesByStatus = new Map<EvaluableComplianceStatus, number[]>();

    for (const update of dto.updates) {
      const record = recordMap.get(update.id);
      if (!record) {
        continue;
      }

      if (
        record.deletedAt !== null ||
        record.status === ComplianceStatus.RENEWED ||
        record.status === ComplianceStatus.ARCHIVED
      ) {
        continue;
      }

      if (record.status === update.newStatus) {
        continue;
      }

      const newStatus = update.newStatus as EvaluableComplianceStatus;
      const idsForStatus = updatesByStatus.get(newStatus) ?? [];
      idsForStatus.push(update.id);
      updatesByStatus.set(newStatus, idsForStatus);
    }

    let processed = 0;

    for (const [newStatus, recordIds] of updatesByStatus.entries()) {
      const result = await this.complianceRecordsRepository
        .createQueryBuilder()
        .update(ComplianceRecord)
        .set({ status: newStatus })
        .where('id IN (:...recordIds)', { recordIds })
        .andWhere('deletedAt IS NULL')
        .andWhere('status NOT IN (:...terminalStatuses)', {
          terminalStatuses: [
            ComplianceStatus.RENEWED,
            ComplianceStatus.ARCHIVED,
          ],
        })
        .andWhere('status <> :newStatus', { newStatus })
        .execute();

      processed += result.affected ?? 0;
    }

    return { processed };
  }

  async archive(id: number): Promise<void> {
    const record = await this.findOne(id);

    if (
      record.status === ComplianceStatus.RENEWED ||
      record.status === ComplianceStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Compliance record is already renewed or archived',
      );
    }

    record.status = ComplianceStatus.ARCHIVED;
    await this.complianceRecordsRepository.save(record);
    await this.complianceRecordsRepository.softDelete(id);
  }
}
