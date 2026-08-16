import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/api-error.filter';
import { createValidationPipe } from './common/validation.pipe';
import { ShiftsFixturesProvider } from './shifts/shifts-fixtures.provider';

async function bootstrap(): Promise<void> {
  // Buffer logs until the pino logger is attached below, so nothing before that point
  // falls back to Nest's default console logger.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  // Public read/write demo API, no auth, no cookies - open by default. Restrict via
  // CORS_ORIGIN once this has a specific web client to lock down to.
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*', methods: ['GET', 'POST'] });
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : String(reason));
  });
  const fixtures = app.get(ShiftsFixturesProvider);

  // No create-shift endpoint exists, so seeding stays on by default even in production.
  if (process.env.SEED_DEMO_DATA === 'false') {
    logger.warn('SEED_DEMO_DATA=false: skipping demo fixture generation, store will boot empty.');
  } else {
    const shifts = fixtures.generateFixtures();
    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        `Generating ${shifts.length} random demo shift(s) on a production boot - this in-memory ` +
          `store has no real persistence yet. Set SEED_DEMO_DATA=false once a real datastore is wired in.`,
      );
    } else {
      logger.log(`Generated ${shifts.length} shift(s):`);
    }
    for (const shift of shifts) {
      logger.log(`  - ${shift.id}  ${shift.brand.name} / ${shift.branch.name}`);
      logger.log(`      ${shift.startDate}  ->  ${shift.endDate}`);
    }
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  logger.log(`Shiftly API listening on http://localhost:${port}`);
  logger.log(`User ID: ${fixtures.DEFAULT_USER_ID}`);
}

bootstrap();
