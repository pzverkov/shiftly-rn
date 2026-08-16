import { Platform } from 'react-native';

/**
 * Error reporting seam.
 *
 * One place the whole app funnels unexpected errors through, so wiring a real
 * crash-reporting service (Sentry, Bugsnag) later is a one-function change rather
 * than a hunt through the codebase. For this take-home there is no such backend,
 * so `reportError` logs in development and `submitReport` posts to an optional
 * endpoint - the shape of a real integration without pulling in a heavy SDK.
 */

export type ErrorReport = {
  message: string;
  stack?: string;
  context?: string;
  fatal: boolean;
  platform: string;
  at: number;
};

/**
 * Optional endpoint the "send report" action posts to. Unset in the take-home, so
 * submitReport falls back to a local reference. In production this would be the
 * ingest URL of the reporting service.
 */
const REPORT_URL = process.env.EXPO_PUBLIC_REPORT_URL;

let lastReport: ErrorReport | null = null;

function toReport(error: unknown, opts: { context?: string; fatal: boolean }): ErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    message: err.message,
    stack: err.stack,
    context: opts.context,
    fatal: opts.fatal,
    platform: `${Platform.OS} ${Platform.Version}`,
    at: Date.now(),
  };
}

/**
 * Record an unexpected error. Called from the error boundary and the global
 * handler. This is where a Sentry `captureException` would go.
 */
export function reportError(error: unknown, context?: string, fatal = false): void {
  lastReport = toReport(error, { context, fatal });

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.error(`[report${fatal ? ':fatal' : ''}]${context ? ` ${context}` : ''}`, error);
  }
  // Production: forward `lastReport` to the crash-reporting service here.
}

export type SubmitResult = { ok: boolean; reference: string };

/**
 * User-initiated "send report to the team" from the error screen. Posts the last
 * recorded error plus an optional note. With no endpoint configured it resolves
 * with a local reference so the flow still completes in the take-home.
 */
export async function submitReport(note?: string): Promise<SubmitResult> {
  const reference = `R-${lastReport?.at ?? Date.now()}`;
  const payload = { ...lastReport, note, reference };

  if (!REPORT_URL) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[report] no EXPO_PUBLIC_REPORT_URL set; report not sent', payload);
    }
    return { ok: true, reference };
  }

  try {
    await fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: true, reference };
  } catch {
    return { ok: false, reference };
  }
}
