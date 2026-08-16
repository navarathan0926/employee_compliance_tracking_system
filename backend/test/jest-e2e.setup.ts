import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const devDatabaseName = process.env.DATABASE_NAME;
if (!devDatabaseName) {
  throw new Error('DATABASE_NAME must be set in backend/.env for e2e tests');
}

const e2eDatabaseName =
  process.env.E2E_DATABASE_NAME ?? `${devDatabaseName}_e2e`;

if (e2eDatabaseName === devDatabaseName) {
  throw new Error(
    `E2E database must differ from dev DB. Set E2E_DATABASE_NAME in backend/.env (both currently "${devDatabaseName}")`,
  );
}

process.env.DATABASE_NAME = e2eDatabaseName;
