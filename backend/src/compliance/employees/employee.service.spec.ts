import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceRecord } from '../compliance-records/compliance-record.entity';
import { EmployeeService } from './employee.service';
import { Employee } from './employee.entity';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let employeesRepo: jest.Mocked<Repository<Employee>>;
  let transactionMock: jest.Mock;

  beforeEach(async () => {
    transactionMock = jest.fn();
    employeesRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 1, ...value })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: transactionMock,
      },
    } as unknown as jest.Mocked<Repository<Employee>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: getRepositoryToken(Employee),
          useValue: employeesRepo,
        },
        {
          provide: getRepositoryToken(ComplianceRecord),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(EmployeeService);
  });

  it('archives employee and cascades compliance records in one transaction', async () => {
    const employee = {
      id: 1,
      name: 'Jane',
      department: 'Engineering',
    } as Employee;

    const softRemove = jest.fn();
    const execute = jest.fn();
    transactionMock.mockImplementation(async (callback) =>
      callback({
        findOne: jest.fn().mockResolvedValue(employee),
        softRemove,
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute,
        })),
      }),
    );

    await service.archive(1);

    expect(softRemove).toHaveBeenCalledWith(Employee, employee);
    expect(execute).toHaveBeenCalled();
  });

  it('throws NotFoundException when employee is missing', async () => {
    transactionMock.mockImplementation(async (callback) =>
      callback({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(service.archive(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});
