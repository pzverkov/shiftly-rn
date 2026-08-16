import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ShiftsModule } from './shifts/shifts.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Structured JSON logs on stdout - every @nestjs/common Logger call routes through
    // this once main.ts registers it via app.useLogger(), no call-site changes needed.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: true,
      },
    }),
    ShiftsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
