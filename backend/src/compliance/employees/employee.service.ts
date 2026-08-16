import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaginatedResult,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { ComplianceStatus } from '../../common/enums/compliance-status.enum';
import { ComplianceRecord } from '../compliance-records/compliance-record.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(ComplianceRecord)
    private readonly complianceRecordsRepository: Repository<ComplianceRecord>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeesRepository.create(dto);
    return this.employeesRepository.save(employee);
  }

  async findAll(query: ListEmployeesQueryDto): Promise<PaginatedResult<Employee>> {
    const { limit, offset } = resolvePagination(query);
    const qb = this.employeesRepository
      .createQueryBuilder('employee')
      .where('employee.deletedAt IS NULL');

    if (query.department) {
      qb.andWhere('employee.department = :department', {
        department: query.department,
      });
    }

    qb.orderBy('employee.id', 'ASC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, limit, offset };
  }

  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return employee;
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);
    Object.assign(employee, dto);
    return this.employeesRepository.save(employee);
  }

  async archive(id: number): Promise<void> {
    await this.employeesRepository.manager.transaction(async (manager) => {
      const employee = await manager.findOne(Employee, { where: { id } });
      if (!employee) {
        throw new NotFoundException(`Employee ${id} not found`);
      }

      await manager.softRemove(Employee, employee);

      await manager
        .createQueryBuilder()
        .update(ComplianceRecord)
        .set({
          status: ComplianceStatus.ARCHIVED,
          deletedAt: () => 'CURRENT_TIMESTAMP(6)',
        })
        .where('employeeId = :employeeId', { employeeId: id })
        .andWhere('deletedAt IS NULL')
        .execute();
    });
  }
}
