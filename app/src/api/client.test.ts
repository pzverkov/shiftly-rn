import { apiFetch } from './client';
import { ApiError, NetworkError } from './errors';
import { getOffsetMs, resetServerClock } from '../time/serverClock';

/**
 * The transport. `apiFetch` is the one place every request funnels through, so its
 * failure mapping is load-bearing: a business rejection must not look retryable, a
 * dropped connection must, and a connection that opens then goes quiet must abort
 * rather than hang the UI on a spinner. None of that is visible in a happy-path
 * demo, so it is asserted here.
 */

const fetchMock = jest.fn();

/** A 2xx JSON response with a controllable Date header. */
function ok(body: unknown, dateHeader?: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h === 'date' ? (dateHeader ?? null) : null) },
    json: async () => body,
  } as unknown as Response;
}

/** A non-2xx response carrying our error envelope. */
function errorEnvelope(status: number, body: unknown, dateHeader?: string): Response {
  return {
    ok: false,
    status,
    headers: { get: (h: string) => (h === 'date' ? (dateHeader ?? null) : null) },
    json: async () => body,
  } as unknown as Response;
}

/** A non-2xx response whose body is not JSON - a proxy or captive portal answered. */
function nonJsonError(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  } as unknown as Response;
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetServerClock();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('apiFetch on success', () => {
  it('hits the base URL and sends JSON headers merged with the caller-supplied ones', async () => {
    fetchMock.mockResolvedValue(ok({}, new Date().toUTCString()));

    await apiFetch('/thing', { method: 'POST', headers: { 'X-Test': '1' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/thing');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Test': '1' });
    // Every request is armed with an abort signal for the timeout.
    expect(init.signal).toBeDefined();
  });

  it('returns the parsed body and samples the server clock from the Date header', async () => {
    // A header a minute ahead of the device: the offset must move towards it.
    const future = new Date(Date.now() + 60_000).toUTCString();
    fetchMock.mockResolvedValue(ok({ hello: 'world' }, future));

    const data = await apiFetch<{ hello: string }>('/thing');

    expect(data).toEqual({ hello: 'world' });
    expect(getOffsetMs()).toBeGreaterThan(50_000);
  });
});

describe('apiFetch on a business rejection', () => {
  it('throws a typed ApiError and still samples the clock - a 409 carries the server time too', async () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    fetchMock.mockResolvedValue(
      errorEnvelope(
        409,
        { error: { code: 'SHIFT_ALREADY_STARTED', message: 'nope', details: { shiftId: 's1' } } },
        future,
      ),
    );

    const error = await apiFetch<never>('/thing').catch((e) => e as Error & { cause?: unknown });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'SHIFT_ALREADY_STARTED',
      details: { shiftId: 's1' },
    });
    // The error path is trusted for the clock because a real envelope proves it is our API.
    expect(getOffsetMs()).toBeGreaterThan(50_000);
  });

  it('maps an error body with no code to a NetworkError - something other than our API answered', async () => {
    fetchMock.mockResolvedValue(nonJsonError(502));

    const error = await apiFetch<never>('/thing').catch((e) => e as Error & { cause?: unknown });

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain('Unexpected 502');
  });
});

describe('apiFetch on a transport failure', () => {
  it('wraps a dropped connection as a NetworkError, preserving the cause', async () => {
    const cause = new TypeError('Network request failed');
    fetchMock.mockRejectedValue(cause);

    const error = await apiFetch<never>('/thing').catch((e) => e as Error & { cause?: unknown });

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain('Could not reach the server');
    expect(error.cause).toBe(cause);
  });

  it('maps an abort to a timeout NetworkError', async () => {
    // The robust half of the timeout contract - no fake timers, so it cannot flake.
    fetchMock.mockRejectedValue(abortError());

    const error = await apiFetch<never>('/thing').catch((e) => e as Error & { cause?: unknown });

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain('timed out');
  });

  it('aborts even when the response body hangs, so the timeout covers the whole read', async () => {
    // The regression: an earlier version cleared the timer once fetch resolved, before
    // reading the body, so a connection that opened then went quiet during json() hung
    // on the spinner. The timer must stay armed through the body read.
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(abortError()));
          }),
      } as unknown as Response),
    );

    // Attach the catch before advancing so the rejection is never momentarily
    // unhandled while the fake timer fires.
    const pending = apiFetch<never>('/thing').catch((e) => e as Error & { cause?: unknown });
    await jest.advanceTimersByTimeAsync(10_000);
    const error = await pending;

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toContain('timed out');
  });
});
