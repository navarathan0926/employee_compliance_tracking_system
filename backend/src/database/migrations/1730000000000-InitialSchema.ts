import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_users_username',
            columnNames: ['username'],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'employees',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'department',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            precision: 6,
            isNullable: true,
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_employee_department',
            columnNames: ['department'],
          }),
          new TableIndex({
            name: 'IDX_employee_deletedAt',
            columnNames: ['deletedAt'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'compliance_records',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'employeeId',
            type: 'int',
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'visa',
              'certification',
              'background_check',
              'training',
              'other',
            ],
          },
          {
            name: 'issuedDate',
            type: 'date',
          },
          {
            name: 'expiryDate',
            type: 'date',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'expiring', 'expired', 'renewed', 'archived'],
          },
          {
            name: 'renewedFromId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'lastEvaluatedStatus',
            type: 'enum',
            enum: ['active', 'expiring', 'expired'],
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            precision: 6,
            isNullable: true,
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_compliance_employeeId',
            columnNames: ['employeeId'],
          }),
          new TableIndex({
            name: 'IDX_compliance_status',
            columnNames: ['status'],
          }),
          new TableIndex({
            name: 'IDX_compliance_expiryDate',
            columnNames: ['expiryDate'],
          }),
          new TableIndex({
            name: 'IDX_compliance_deletedAt',
            columnNames: ['deletedAt'],
          }),
          new TableIndex({
            name: 'IDX_compliance_status_expiry_deleted',
            columnNames: ['status', 'expiryDate', 'deletedAt'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'compliance_records',
      new TableForeignKey({
        name: 'FK_compliance_employee',
        columnNames: ['employeeId'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'compliance_records',
      new TableForeignKey({
        name: 'FK_compliance_renewed_from',
        columnNames: ['renewedFromId'],
        referencedTableName: 'compliance_records',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('compliance_records', true, true, true);
    await queryRunner.dropTable('employees', true, true, true);
    await queryRunner.dropTable('users', true, true, true);
  }
}
