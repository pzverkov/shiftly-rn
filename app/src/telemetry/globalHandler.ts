import { reportError } from './report';

/**
 * Catch the errors an error boundary cannot: uncaught exceptions and rejected
 * promises that never touched the React tree (a stray `setTimeout`, an unhandled
 * background task). We log them through the same seam, then hand back to the
 * default handler so development still shows the red box and production still
 * behaves as the platform intends.
 */

type ErrorUtilsShim = {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

let installed = false;

export function initGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsShim }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const defaultHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, 'uncaught', Boolean(isFatal));
    defaultHandler?.(error, isFatal);
  });
}
