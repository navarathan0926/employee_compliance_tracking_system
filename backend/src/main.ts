import { Logger, ValidationPipe } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { NestFactory } from '@nestjs/core';

import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

import { AppModule } from './app.module';

import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { setupSwagger } from './swagger';



async function bootstrap() {

  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {

    logger: ['log', 'error', 'warn', 'debug', 'verbose'],

  });

  const configService = app.get(ConfigService);



  app.setGlobalPrefix('api');

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(

    new ValidationPipe({

      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,

      transformOptions: { enableImplicitConversion: false },

    }),

  );



  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  const corsOrigins = configService

    .get<string>('CORS_ALLOWED_ORIGINS', 'http://localhost:5173, http://localhost:5174')

    .split(',')

    .map((origin) => origin.trim())

    .filter(Boolean);

  const isLocalDevOrigin = (origin: string): boolean =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (nodeEnv !== 'production' && isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  };

  app.enableCors(corsOptions);

  if (nodeEnv !== 'production') {

    setupSwagger(app);

  }



  const port = Number(configService.get<string>('PORT', '3000'));

  await app.listen(port);



  logger.log(`Application running on http://localhost:${port}/api`);

  if (nodeEnv !== 'production') {

    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);

  }

}



bootstrap();

