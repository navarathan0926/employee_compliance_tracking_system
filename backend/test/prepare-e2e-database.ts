import { createConnection } from 'mysql2/promise';
import dataSource from '../src/database/data-source';
import { runSeed } from '../src/database/run-seed';

function assertSafeDatabaseName(name: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid database name for e2e setup: "${name}"`);
  }

  return name;
}

async function ensureE2eDatabaseExists(): Promise<void> {
  const databaseName = assertSafeDatabaseName(process.env.DATABASE_NAME ?? '');

  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await connection.end();
}

export async function prepareE2eDatabase(): Promise<void> {
  await ensureE2eDatabaseExists();

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await dataSource.runMigrations();
  await runSeed(dataSource);

  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
