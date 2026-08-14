import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceConfigService } from '../common/compliance-config.service';
import { ComplianceStatus } from '../common/enums/compliance-status.enum';
import { ComplianceType } from '../common/enums/compliance-type.enum';
import { ComplianceRecord } from '../compliance/compliance-records/compliance-record.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let baseQueryBuilder: {
    clone: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    groupBy: jest.Mock;
    addGroupBy: jest.Mock;
    innerJoin: jest.Mock;
    innerJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    getRawMany: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    baseQueryBuilder = {
      clone: jest.fn(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    baseQueryBuilder.clone.mockReturnValue(baseQueryBuilder);

    const complianceRepo = {
      createQueryBuilder: jest.fn(() => baseQueryBuilder),
    } as unknown as Repository<ComplianceRecord>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(ComplianceRecord),
          useValue: complianceRepo,
        },
        {
          provide: ComplianceConfigService,
          useValue: { timezone: 'Asia/Colombo', bufferDays: 30 },
        },
      ],
    }).compile();

    service = module.get(DashboardService);
    jest.spyOn(service as never, 'getToday').mockReturnValue('2026-08-14');
  });

  it('returns live totals excluding renewed and archived statuses', async () => {
    baseQueryBuilder.getRawMany.mockResolvedValue([
      { status: ComplianceStatus.ACTIVE, count: '2' },
      { status: ComplianceStatus.EXPIRING, count: '1' },
      { status: ComplianceStatus.EXPIRED, count: '3' },
    ]);

    const result = await service.getMetrics({});

    expect(result.totals).toEqual({
      active: 2,
      expiring: 1,
      expired: 3,
    });
    expect(baseQueryBuilder.andWhere).toHaveBeenCalledWith(
      'record.status IN (:...statuses)',
      {
        statuses: [
          ComplianceStatus.ACTIVE,
          ComplianceStatus.EXPIRING,
          ComplianceStatus.EXPIRED,
        ],
      },
    );
  });

  it('includes optional department and type breakdowns', async () => {
    baseQueryBuilder.getRawMany
      .mockResolvedValueOnce([
        { status: ComplianceStatus.ACTIVE, count: '1' },
      ])
      .mockResolvedValueOnce([
        {
          key: 'Engineering',
          status: ComplianceStatus.ACTIVE,
          count: '1',
        },
      ])
      .mockResolvedValueOnce([
        { key: ComplianceType.VISA, status: ComplianceStatus.ACTIVE, count: '1' },
      ]);

    const result = await service.getMetrics({
      departmentBreakdown: true,
      typeBreakdown: true,
    });

    expect(result.byDepartment).toEqual([
      { department: 'Engineering', active: 1, expiring: 0, expired: 0 },
    ]);
    expect(result.byType).toEqual([
      { type: ComplianceType.VISA, active: 1, expiring: 0, expired: 0 },
    ]);
  });
});
