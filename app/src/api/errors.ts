/**
 * The API's error contract, and what we do about each case.
 *
 * The classifier below is the single place that decides retry behaviour. Getting
 * this wrong in either direction is the classic mistake: retry a business
 * rejection and you risk acting twice, treat a stale-cache conflict as a failure
 * and you show the user an error for something that already succeeded.
 */

/** Every `error.code` the server can return (api/src/common/api-error.pure.js). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'SHIFT_NOT_FOUND'
  | 'SHIFT_WRONG_DAY'
  | 'SHIFT_START_TOO_EARLY'
  | 'SHIFT_ALREADY_STARTED'
  | 'SHIFT_ALREADY_FINISHED'
  | 'SHIFT_NOT_STARTED'
  | 'SHIFT_FINISH_TOO_LATE'
  | 'SHIFT_OUT_OF_RANGE'
  | 'BREAK_TOO_SOON_AFTER_START'
  | 'BREAK_LIMIT_REACHED'
  | 'BREAK_ALREADY_ACTIVE'
  | 'BREAK_END_TOO_SOON'
  | 'BREAK_NOT_ACTIVE';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The request never got an answer: offline, DNS, timeout, server down. */
export class NetworkError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export type ErrorBucket =
  /** Transport failed. Safe to retry - the request may never have been seen. */
  | 'retryable'
  /**
   * The server and our cache disagree, and the server is already in the state the
   * user wanted. Not a failure: refetch and treat it as success.
   */
  | 'reconcile'
  /** A business rule said no. Show the message. Retrying would be wrong. */
  | 'terminal';

const RECONCILABLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'SHIFT_ALREADY_STARTED',
  'SHIFT_ALREADY_FINISHED',
  'BREAK_ALREADY_ACTIVE',
  'BREAK_NOT_ACTIVE',
]);

/**
 * `SHIFT_ALREADY_STARTED` is the load-bearing case. It is what makes retrying
 * `POST /shifts/:id/start` safe at all: the endpoint is effectively idempotent,
 * because a duplicate start is answered with this code rather than a second
 * clock-in. Treating it as success is what earns the right to retry a POST.
 *
 * The break equivalents work the same way - a duplicated "start break" comes back
 * as BREAK_ALREADY_ACTIVE, which means the break we wanted is already running.
 */
export function classifyError(error: unknown): ErrorBucket {
  if (error instanceof NetworkError) return 'retryable';

  if (error instanceof ApiError) {
    if (RECONCILABLE.has(error.code)) return 'reconcile';
    // 5xx is the server falling over rather than judging us; the request can be
    // safely repeated for the same reason a NetworkError can.
    if (error.status >= 500) return 'retryable';
    return 'terminal';
  }

  // An unrecognised throw is a bug in our code, not a flaky network. Retrying a
  // bug just runs it again.
  return 'terminal';
}
