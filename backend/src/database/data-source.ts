import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../auth/user.entity';
import { Employee } from '../compliance/employees/employee.entity';
import { ComplianceRecord } from '../compliance/compliance-records/compliance-record.entity';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { RemoveLastEvaluatedStatus1730000000001 } from './migrations/1730000000001-RemoveLastEvaluatedStatus';
import { buildTypeOrmExtra } from './typeorm-options';

config({ path: '.env' });

export default new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  timezone: 'Z',
  entities: [User, Employee, ComplianceRecord],
  migrations: [InitialSchema1730000000000, RemoveLastEvaluatedStatus1730000000001],
  migrationsTableName: 'typeorm_migrations',
  extra: buildTypeOrmExtra(),
});
