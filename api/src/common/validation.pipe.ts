import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ERRORS } = require('./api-error.pure') as {
  ERRORS: { VALIDATION_ERROR: (msg: string, details?: unknown) => Error };
};

function flattenErrors(errors: ValidationError[]): { field: string; constraints: string[] }[] {
  return errors.flatMap((error) => {
    if (error.children?.length) return flattenErrors(error.children);
    return [{ field: error.property, constraints: Object.values(error.constraints ?? {}) }];
  });
}

// Maps class-validator's default error shape into the app's existing ApiError envelope,
// so a request-shape failure looks identical to any other VALIDATION_ERROR response.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const fields = flattenErrors(errors);
      const message = fields.flatMap((f) => f.constraints).join('; ') || 'Validation failed.';
      return ERRORS.VALIDATION_ERROR(message, { fields });
    },
  });
}
