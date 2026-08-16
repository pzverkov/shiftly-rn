/**
 * The error-reporting seam. These lock the two behaviours the UI depends on:
 * a report always resolves (so the "send report" button never hangs), and it
 * posts to the configured endpoint when one exists.
 */

function loadWithEnv(reportUrl?: string) {
  jest.resetModules();
  if (reportUrl) process.env.EXPO_PUBLIC_REPORT_URL = reportUrl;
  else delete process.env.EXPO_PUBLIC_REPORT_URL;
  return require('./report') as typeof import('./report');
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_REPORT_URL;
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('submitReport', () => {
  it('resolves with a reference even when no endpoint is configured', async () => {
    const { reportError, submitReport } = loadWithEnv();
    reportError(new Error('boom'), 'render');

    const result = await submitReport();

    expect(result.ok).toBe(true);
    expect(result.reference).toMatch(/^R-\d+$/);
  });

  it('posts the report to the configured endpoint', async () => {
    const { reportError, submitReport } = loadWithEnv('https://example.test/report');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    reportError(new Error('kaboom'), 'render', true);

    const result = await submitReport('user note');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/report',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ message: 'kaboom', context: 'render', fatal: true, note: 'user note' });
  });

  it('reports failure rather than throwing when the post fails', async () => {
    const { submitReport } = loadWithEnv('https://example.test/report');
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('network down'));

    await expect(submitReport()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
  });
});
