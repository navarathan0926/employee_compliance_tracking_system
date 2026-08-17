import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ComplianceType } from '../../common/enums/compliance-type.enum';
import { ComplianceStatus } from '../../common/enums/compliance-status.enum';
import { Employee } from '../employees/employee.entity';

@Entity('compliance_records')
@Index('IDX_compliance_status_expiry_deleted', [
  'status',
  'expiryDate',
  'deletedAt',
])
export class ComplianceRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_compliance_employeeId')
  @Column()
  employeeId!: number;

  @ManyToOne(() => Employee, (employee) => employee.complianceRecords, {
    nullable: false,
  })
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;

  @Column({ type: 'enum', enum: ComplianceType })
  type!: ComplianceType;

  @Column({ type: 'date' })
  issuedDate!: string;

  @Index('IDX_compliance_expiryDate')
  @Column({ type: 'date' })
  expiryDate!: string;

  @Index('IDX_compliance_status')
  @Column({ type: 'enum', enum: ComplianceStatus })
  status!: ComplianceStatus;

  @Column({ nullable: true })
  renewedFromId!: number | null;

  @ManyToOne(() => ComplianceRecord, { nullable: true })
  @JoinColumn({ name: 'renewedFromId' })
  renewedFrom!: ComplianceRecord | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @Index('IDX_compliance_deletedAt')
  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;
}
