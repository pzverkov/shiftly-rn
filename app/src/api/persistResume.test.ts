import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';

import type { QueryClient } from '@tanstack/react-query';

import { createQueryClient, shiftKeys } from './queries';
import type { StartShiftVariables } from './shifts';
import { makeShift } from '../domain/testFixtures';
import type { Shift } from '../domain/shift';
import { resetServerClock } from '../time/serverClock';

/**
 * The end of the offline story that only a cold start exercises: a clock-in queued
 * with no signal is written to disk, the app is killed, and on the next launch the
 * persisted mutation is restored and replayed.
 *
 * The unit tests drive the resume path in-process (queries.test.ts); this one does
 * the real round trip - dehydrate to AsyncStorage, throw the client away, rehydrate
 * a brand new one, and resume - because that is where a break silently loses the
 * mutationFn or its cache write and nothing else would notice.
 */

const SHIFT = makeShift({ id: 'shift-1', startDate: '2026-07-16T14:00:00.000Z' });
const STARTED_AT = '2026-07-16T13:50:00.000Z';

// Pressed two minutes before the (simulated) resume, so the replay classifies as
// delayed and sends the captured press time rather than letting the server stamp now.
const PRESSED_SERVER_MS = new Date('2026-07-16T13:49:00.000Z').getTime();

const queuedOffline = (): StartShiftVariables => ({
  shiftId: SHIFT.id,
  location: SHIFT.branch.location,
  pressedAtServerMs: PRESSED_SERVER_MS,
  pressedAtDeviceMs: Date.now() - 120_000,
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => new Date(STARTED_AT).toUTCString() },
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn();
const persister = createAsyncStoragePersister({ storage: AsyncStorage });

// Every client created in a test is tracked so afterEach can destroy its caches.
// A cached query and a paused mutation each arm a gc timer (24h and 5min here); left
// alive they hold the jest worker open long after the assertions pass.
const clients: QueryClient[] = [];
function trackedClient(): QueryClient {
  const client = createQueryClient();
  clients.push(client);
  return client;
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetServerClock();
  await AsyncStorage.clear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) {
    client.getQueryCache().getAll().forEach((query) => query.destroy());
    client.getMutationCache().getAll().forEach((mutation) => mutation.destroy());
    client.clear();
  }
});

/** Let paused-mutation and persistence microtasks settle without fake timers. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('a clock-in queued offline, then replayed after a cold start', () => {
  it('restores the persisted mutation and both sends it and writes the cache', async () => {
    // Phase 1: offline. Cache the list, queue the clock-in, and persist to disk -
    // exactly the state a phone is in when it is killed in a basement.
    onlineManager.setOnline(false);
    const before = trackedClient();
    before.setQueryData<Shift[]>(shiftKeys.list(), [SHIFT]);

    before
      .getMutationCache()
      .build(before, { mutationKey: shiftKeys.start() })
      .execute(queuedOffline())
      .catch(() => {});

    // The write must be paused (not run) before we snapshot it to disk.
    for (let i = 0; i < 10 && !before.getMutationCache().getAll()[0]?.state.isPaused; i += 1) {
      await flush();
    }
    expect(before.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);

    await persistQueryClientSave({ queryClient: before, persister });

    // Phase 2: cold start. A brand new client, hydrated from disk, then back online.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/start')
          ? jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } })
          : jsonResponse({ shifts: [{ ...SHIFT, startedAt: STARTED_AT }] }),
      ),
    );

    const after = trackedClient();
    await persistQueryClientRestore({ queryClient: after, persister });

    // The restored mutation carries no function or callbacks; it lands them from the
    // client defaults, which is the property this test is really guarding.
    expect(after.getMutationCache().getAll()).toHaveLength(1);

    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    await flush();

    // It reached the server, and as a delayed replay it sent the captured press time.
    const startCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/start'));
    expect(startCall).toBeDefined();
    expect(JSON.parse(startCall![1].body).datetime).toBe(new Date(PRESSED_SERVER_MS).toISOString());

    // And the cache write ran, so the reopened app shows the shift as started.
    expect(after.getQueryData<Shift[]>(shiftKeys.list())?.[0].startedAt).toBe(STARTED_AT);
  });
});
