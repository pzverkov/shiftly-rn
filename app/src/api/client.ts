import { ApiError, NetworkError, type ApiErrorCode } from './errors';
import { sampleServerDate } from '../time/serverClock';

/**
 * `localhost` is the phone itself, not the dev machine. The Android emulator maps
 * the host to 10.0.2.2; a physical device needs the machine's LAN IP. Set
 * EXPO_PUBLIC_API_URL to override - see the README.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * `fetch` has no timeout of its own. Without this, a connection that opens and
 * then goes quiet - a captive portal, a flaky kitchen wifi - hangs until the OS
 * gives up, which can be minutes. The user would see a spinner the whole time.
 */
const REQUEST_TIMEOUT_MS = 10_000;

type ErrorEnvelope = {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    // Only trust the Date header once we know this is a 2xx from our API - a
    // captive portal or proxy answering 200 is still our clock's problem, but a
    // 200 that parses as the expected shape is as good a time source as any.
    sampleServerDate(response.headers.get('date'));

    return (await response.json()) as T;
  } catch (cause) {
    // An ApiError from toApiError is already the right thing - do not rewrap it as
    // a network failure, or a business rejection would look retryable.
    if (cause instanceof ApiError || cause instanceof NetworkError) throw cause;

    // Offline, DNS failure, refused connection, a body that stops mid-stream, or
    // our own timeout abort. All mean "no usable answer", which is retryable. The
    // timer stays armed through the body read above, so a connection that opens
    // then goes quiet still aborts here rather than hanging on the spinner.
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new NetworkError(
      aborted ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms` : 'Could not reach the server',
      cause,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function toApiError(response: Response): Promise<ApiError | NetworkError> {
  let envelope: ErrorEnvelope | null = null;
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // A non-JSON error body means something other than our API answered - a proxy,
    // a captive portal, a crashed server. There is no contract to read here.
    envelope = null;
  }

  const code = envelope?.error?.code;
  if (!code) {
    return new NetworkError(`Unexpected ${response.status} response from the server`);
  }

  // A real error envelope proves this is our API, so its Date header is trustworthy
  // even though the request failed - a 409 carries the server clock as well as a 200.
  sampleServerDate(response.headers.get('date'));

  return new ApiError(
    response.status,
    code as ApiErrorCode,
    envelope?.error?.message ?? 'Something went wrong.',
    envelope?.error?.details,
  );
}
