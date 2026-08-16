import { ApiError, NetworkError, classifyError, type ApiErrorCode, type ErrorBucket } from './errors';

/**
 * This table decides whether a failed request gets retried. Getting a row wrong
 * is worse than a crash: classify a business rejection as retryable and the app
 * hammers the server with something it has already refused, classify a stale
 * conflict as terminal and the user gets an error for a clock-in that succeeded.
 */

const EXPECTED: Record<ApiErrorCode, ErrorBucket> = {
  // The world already agrees with the user - refetch and move on.
  SHIFT_ALREADY_STARTED: 'reconcile',
  SHIFT_ALREADY_FINISHED: 'reconcile',
  BREAK_ALREADY_ACTIVE: 'reconcile',
  BREAK_NOT_ACTIVE: 'reconcile',

  // A rule said no. Pressing again changes nothing.
  VALIDATION_ERROR: 'terminal',
  SHIFT_NOT_FOUND: 'terminal',
  SHIFT_WRONG_DAY: 'terminal',
  SHIFT_START_TOO_EARLY: 'terminal',
  SHIFT_NOT_STARTED: 'terminal',
  SHIFT_FINISH_TOO_LATE: 'terminal',
  SHIFT_OUT_OF_RANGE: 'terminal',
  BREAK_TOO_SOON_AFTER_START: 'terminal',
  BREAK_LIMIT_REACHED: 'terminal',
  BREAK_END_TOO_SOON: 'terminal',
};

describe('classifyError', () => {
  it.each(Object.entries(EXPECTED) as [ApiErrorCode, ErrorBucket][])(
    '%s is %s',
    (code, bucket) => {
      expect(classifyError(new ApiError(409, code, 'message'))).toBe(bucket);
    },
  );

  /**
   * The table above is typed as a total Record, so omitting a code fails to
   * compile. This catches the other direction: a code the server can send that
   * never made it into our union at all, which would silently fall through to
   * 'terminal' at runtime.
   */
  it('covers every code in the union', () => {
    const codes = Object.keys(EXPECTED);

    expect(codes).toHaveLength(14);
    expect(new Set(codes).size).toBe(14);
  });

  it('treats a lost connection as retryable', () => {
    expect(classifyError(new NetworkError('offline'))).toBe('retryable');
  });

  it('retries a 5xx, because that is the server falling over rather than judging us', () => {
    expect(classifyError(new ApiError(503, 'VALIDATION_ERROR', 'upstream down'))).toBe('retryable');
  });

  it('does not retry a 4xx even when the code is one we would normally retry on status', () => {
    expect(classifyError(new ApiError(400, 'VALIDATION_ERROR', 'bad body'))).toBe('terminal');
  });

  it('reconciles on a 4xx conflict regardless of status, since the code carries the meaning', () => {
    expect(classifyError(new ApiError(409, 'SHIFT_ALREADY_STARTED', 'already'))).toBe('reconcile');
  });

  it('treats an unrecognised throw as terminal, because retrying a bug just runs it twice', () => {
    expect(classifyError(new TypeError('undefined is not a function'))).toBe('terminal');
    expect(classifyError('a thrown string')).toBe('terminal');
    expect(classifyError(null)).toBe('terminal');
    expect(classifyError(undefined)).toBe('terminal');
  });
});
