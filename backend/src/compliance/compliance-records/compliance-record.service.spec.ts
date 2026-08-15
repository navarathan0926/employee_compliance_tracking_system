import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceConfigService } from '../../common/compliance-config.service';
import { ComplianceStatus } from '../../common/enums/compliance-status.enum';
import { ComplianceType } from '../../common/enums/compliance-type.enum';
import { Employee } from '../employees/employee.entity';
import { ComplianceRecord } from './compliance-record.entity';
import { ComplianceRecordService } from './compliance-record.service';

describe('ComplianceRecordService', () => {
  let service: ComplianceRecordService;
  let complianceRepo: jest.Mocked<Repository<ComplianceRecord>>;
  let employeeRepo: jest.Mocked<Repository<Employee>>;
  let bulkUpdateExecute: jest.Mock;

  const complianceConfig = {
    bufferDays: 30,
    timezone: 'Asia/Colombo',
  };

  beforeEach(async () => {
    bulkUpdateExecute = jest.fn().mockResolvedValue({ affected: 1 });

    const bulkUpdateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: bulkUpdateExecute,
    };

    complianceRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
      find: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn((alias?: string) =>
        alias ? ({} as never) : bulkUpdateQueryBuilder,
      ),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({
            findOne: jest.fn(),
            create: jest.fn((_, value) => value),
            save: jest.fn(async (value) => ({ id: 99, ...value })),
            softDelete: jest.fn(),
          }),
        ),
      },
    } as unknown as jest.Mocked<Repository<ComplianceRecord>>;

    employeeRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Employee>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceRecordService,
        {
          provide: getRepositoryToken(ComplianceRecord),
          useValue: complianceRepo,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: employeeRepo,
        },
        {
          provide: ComplianceConfigService,
          useValue: complianceConfig,
        },
      ],
    }).compile();

    service = module.get(ComplianceRecordService);
    jest.spyOn(service as never, 'getToday').mockReturnValue('2026-08-14');
  });

  it('rejects create when expiryDate is not after issuedDate', async () => {
    employeeRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Jane',
      department: 'Engineering',
    } as Employee);

    await expect(
      service.create({
        employeeId: 1,
        type: ComplianceType.VISA,
        issuedDate: '2026-08-14',
        expiryDate: '2026-08-14',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recalculates status on date PATCH', async () => {
    const record = {
      id: 1,
      employeeId: 1,
      type: ComplianceType.VISA,
      issuedDate: '2026-01-01',
      expiryDate: '2026-01-15',
      status: ComplianceStatus.EXPIRED,
      notes: null,
      renewedFromId: null,
      deletedAt: null,
    } as ComplianceRecord;

    jest.spyOn(service, 'findOne').mockResolvedValue(record);

    const updated = await service.update(1, { expiryDate: '2027-01-01' });

    expect(updated.status).toBe(ComplianceStatus.ACTIVE);
  });

  it('skips bulk-status updates for renewed records and unchanged statuses', async () => {
    const activeRecord = {
      id: 1,
      employeeId: 1,
      status: ComplianceStatus.ACTIVE,
      deletedAt: null,
    } as ComplianceRecord;
    const renewedRecord = {
      id: 2,
      employeeId: 1,
      status: ComplianceStatus.RENEWED,
      deletedAt: new Date(),
    } as ComplianceRecord;
    const expiringRecord = {
      id: 3,
      employeeId: 1,
      status: ComplianceStatus.EXPIRING,
      deletedAt: null,
    } as ComplianceRecord;

    complianceRepo.find.mockResolvedValue([
      activeRecord,
      renewedRecord,
      expiringRecord,
    ]);

    const result = await service.bulkStatusUpdate({
      updates: [
        { id: 1, newStatus: ComplianceStatus.ACTIVE },
        { id: 2, newStatus: ComplianceStatus.EXPIRING },
        { id: 3, newStatus: ComplianceStatus.EXPIRED },
      ],
    });

    expect(result.processed).toBe(1);
    expect(bulkUpdateExecute).toHaveBeenCalledTimes(1);
    expect(complianceRepo.save).not.toHaveBeenCalled();
  });

  it('throws when renewing an archived record', async () => {
    complianceRepo.manager.transaction = jest.fn(async (callback) => {
      const manager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          employeeId: 1,
          type: ComplianceType.VISA,
          status: ComplianceStatus.ARCHIVED,
        }),
        create: jest.fn(),
        save: jest.fn(),
        softDelete: jest.fn(),
      };
      return callback(manager);
    }) as never;

    await expect(
      service.renew(1, {
        issuedDate: '2026-08-01',
        expiryDate: '2027-08-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when record does not exist', async () => {
    complianceRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});
