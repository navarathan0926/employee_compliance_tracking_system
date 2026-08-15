import { ConfigService } from '@nestjs/config';

export const DEFAULT_DATABASE_POOL_SIZE = 10;
export const DEFAULT_DATABASE_CONNECT_TIMEOUT_MS = 10_000;

export function buildTypeOrmExtra(configService?: ConfigService) {
  const poolSize = configService
    ? Number(
        configService.get<string>(
          'DATABASE_POOL_SIZE',
          String(DEFAULT_DATABASE_POOL_SIZE),
        ),
      )
    : Number(process.env.DATABASE_POOL_SIZE ?? DEFAULT_DATABASE_POOL_SIZE);

  return {
    connectionLimit: poolSize,
    connectTimeout: DEFAULT_DATABASE_CONNECT_TIMEOUT_MS,
  };
}
