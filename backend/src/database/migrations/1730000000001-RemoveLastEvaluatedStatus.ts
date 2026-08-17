import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveLastEvaluatedStatus1730000000001 implements MigrationInterface {
  name = 'RemoveLastEvaluatedStatus1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('compliance_records', 'lastEvaluatedStatus');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'compliance_records',
      new TableColumn({
        name: 'lastEvaluatedStatus',
        type: 'enum',
        enum: ['active', 'expiring', 'expired'],
        isNullable: true,
      }),
    );
  }
}
