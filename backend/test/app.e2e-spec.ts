import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { prepareE2eDatabase } from './prepare-e2e-database';

jest.setTimeout(30_000);

type LoginResponseBody = {
  accessToken: string;
};

type EntityIdBody = {
  id: number;
};

type RenewedRecordBody = {
  id: number;
  renewedFromId: number;
  status: string;
};

type MetricsBody = {
  totals: {
    active: number;
    expiring: number;
    expired: number;
  };
};

describe('Compliance API (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    await prepareE2eDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'change_me_admin_password',
      });

    if (loginResponse.status !== 201 && loginResponse.status !== 200) {
      throw new Error(
        `Login failed (${loginResponse.status}). Check backend/.env seed credentials and E2E database (${process.env.DATABASE_NAME}).`,
      );
    }

    accessToken = (loginResponse.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects protected routes without JWT', async () => {
    await request(app.getHttpServer()).get('/api/employees').expect(401);
  });

  it('rejects pagination limit above 200', async () => {
    await request(app.getHttpServer())
      .get('/api/employees?limit=201')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('rejects invalid compliance status filter values', async () => {
    await request(app.getHttpServer())
      .get('/api/compliance-records?status=activ')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('supports employee cascade archive and compliance renewal flow', async () => {
    const employeeResponse = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E User', department: 'QA' })
      .expect(201);
    const employeeBody = employeeResponse.body as EntityIdBody;

    const recordResponse = await request(app.getHttpServer())
      .post('/api/compliance-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        employeeId: employeeBody.id,
        type: 'visa',
        issuedDate: '2026-01-01',
        expiryDate: '2026-09-01',
      })
      .expect(201);
    const recordBody = recordResponse.body as EntityIdBody;

    const renewResponse = await request(app.getHttpServer())
      .post(`/api/compliance-records/${recordBody.id}/renew`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        issuedDate: '2026-08-01',
        expiryDate: '2027-08-01',
      })
      .expect(201);
    const renewedBody = renewResponse.body as RenewedRecordBody;

    expect(renewedBody.renewedFromId).toBe(recordBody.id);
    expect(renewedBody.status).toBe('active');

    const metricsResponse = await request(app.getHttpServer())
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const metricsBody = metricsResponse.body as MetricsBody;

    const { active, expiring, expired } = metricsBody.totals;
    expect(active + expiring + expired).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .patch('/api/compliance-records/bulk-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        updates: [{ id: renewedBody.id, newStatus: 'active' }],
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/employees/${employeeBody.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });
});
