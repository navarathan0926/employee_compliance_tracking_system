import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/user.entity';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ComplianceModule } from './compliance/compliance.module';
import { ComplianceRecord } from './compliance/compliance-records/compliance-record.entity';
import { Employee } from './compliance/employees/employee.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { InitialSchema1730000000000 } from './database/migrations/1730000000000-InitialSchema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error('JWT_SECRET is required');
        }

        return {
          type: 'mysql' as const,
          host: configService.get<string>('DATABASE_HOST', 'localhost'),
          port: configService.get<number>('DATABASE_PORT', 3306),
          username: configService.get<string>('DATABASE_USER'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
          timezone: 'Z',
          entities: [User, Employee, ComplianceRecord],
          migrations: [InitialSchema1730000000000],
          migrationsRun: false,
          synchronize: false,
        };
      },
    }),
    AuthModule,
    ComplianceModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
