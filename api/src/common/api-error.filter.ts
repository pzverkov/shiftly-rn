import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApiError } = require('./api-error.pure') as { ApiError: new (...args: unknown[]) => Error & { status: number; toJSON(): unknown } };

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      response.status(exception.status).json(exception.toJSON());
      return;
    }

    if (exception instanceof SyntaxError) {
      response.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
      });
      return;
    }

    this.logger.error(exception);
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
    });
  }
}
