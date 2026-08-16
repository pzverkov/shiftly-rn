import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';

import { classifyError } from './errors';
import {
  endBreak,
  finishShift,
  listBreaks,
  listShifts,
  startBreak,
  startShift,
  type BreakVariables,
  type FinishShiftVariables,
  type StartShiftVariables,
  type TimedActionVariables,
} from './shifts';
import { getActiveBreak, type Break } from '../domain/breaks';
import type { Shift } from '../domain/shift';
import { HOUR, MINUTE } from '../time/constants';

export const shiftKeys = {
  all: ['shifts'] as const,
  list: () => [...shiftKeys.all, 'list'] as const,
  start: () => [...shiftKeys.all, 'start'] as const,
  finish: () => [...shiftKeys.all, 'finish'] as const,
  startBreak: () => [...shiftKeys.all, 'break', 'start'] as const,
  endBreak: () => [...shiftKeys.all, 'break', 'end'] as const,
  breaks: (shiftId: string) => [...shiftKeys.all, 'breaks', shiftId] as const,
};

/**
 * Three attempts against React Query's default exponential backoff (~1s, 2s, 4s),
 * so a blip costs the user at most ~7s before the failure is surfaced. Higher and
 * the button sits spinning past the point anyone would keep waiting.
 */
const MAX_RETRIES = 3;

/**
 * The rota changes rarely and a pull-to-refresh is always available, so a short
 * window of serving the cache without refetching is free. Matches the slow tick in
 * `useNow`, which is the coarsest rate at which anything on screen can change.
 */
const LIST_STALE_TIME_MS = 30_000;

/**
 * Long enough that the list survives a day of cold starts, which is the point of
 * persisting it: a phone opened at the start of a shift with no signal still shows
 * yesterday's fetch rather than an empty screen.
 */
const PERSISTED_CACHE_TTL_MS = 24 * HOUR;

// All four shift writes share this scope so React Query runs them one at a time,
// FIFO. That serialisation is what makes an offline break-then-clock-out replay in
// the order it was queued - the finish, which auto-closes the break, cannot race
// ahead of the break it closes.
const SHIFT_MUTATION_SCOPE = { id: 'shift-mutation' } as const;

/**
 * How long after the press a submission is still considered "live". Within this,
 * the server stamps the time; beyond it, the mutation was clearly queued offline
 * and we send the captured press time instead.
 */
const LIVE_SUBMISSION_WINDOW_MS = MINUTE;

/** Only transport failures are retried. See src/api/errors.ts for why. */
function retryOnlyTransport(failureCount: number, error: unknown): boolean {
  return classifyError(error) === 'retryable' && failureCount < MAX_RETRIES;
}

/**
 * The shared spine of every write. Two things happen here, and both matter for the
 * offline-resume path, because this same function is what a paused mutation replays
 * when it resumes:
 *
 *   - Anti-fraud: a live action sends no `datetime`, so the server stamps its own
 *     authoritative clock, which a device clock or timezone change cannot spoof.
 *     Only a submission that was clearly delayed (queued offline and replayed much
 *     later) sends the captured press time, because then the server clock at replay
 *     would be wrong and the press time is the best record we have.
 *   - Reconcile: a duplicate comes back with a reconcilable code (already-started,
 *     already-finished, break already-active/not-active), which is not a failure -
 *     the world already agrees with the user - so we hand off to `reconcile` to
 *     refetch the truth for that specific action.
 *
 * The helper owns only the live-vs-replay rule and the reconcile handoff. What to
 * refetch is the caller's, because it differs per action.
 */
async function timedReconcilingAction<T>(
  variables: TimedActionVariables,
  request: (datetime?: string) => Promise<T>,
  reconcile: (original: unknown) => Promise<T>,
): Promise<T> {
  // Measured on the device clock, NOT serverNow(): the offset can shift between
  // press and submit (the cold-start cache renders the button before the first
  // Date header is sampled), and serverNow()-based elapsed would then misread a
  // live action as a replay and backdate it. The device clock advances steadily
  // over this short window regardless of the offset.
  const elapsed = Date.now() - variables.pressedAtDeviceMs;
  const isReplay = elapsed > LIVE_SUBMISSION_WINDOW_MS;
  const datetime = isReplay ? new Date(variables.pressedAtServerMs).toISOString() : undefined;

  try {
    return await request(datetime);
  } catch (error) {
    if (classifyError(error) !== 'reconcile') throw error;
    return reconcile(error);
  }
}

async function findShift(shiftId: string, original: unknown): Promise<Shift> {
  // The server says the shift is already in the state the user asked for. Our cache
  // was stale; fetch the truth. There is no single-shift GET, so read the list.
  const shifts = await listShifts();
  const shift = shifts.find((candidate) => candidate.id === shiftId);
  if (shift) return shift;
  // Reconciling failed to explain the conflict, so surface the original error
  // rather than inventing a success.
  throw original;
}

/** Clock in, reconciling SHIFT_ALREADY_STARTED against a refetched shift. */
function startShiftReconciling(variables: StartShiftVariables): Promise<Shift> {
  return timedReconcilingAction(
    variables,
    (datetime) => startShift({ shiftId: variables.shiftId, location: variables.location, datetime }),
    (original) => findShift(variables.shiftId, original),
  );
}

/** Clock out, reconciling SHIFT_ALREADY_FINISHED against a refetched shift. */
function finishShiftReconciling(variables: FinishShiftVariables): Promise<Shift> {
  return timedReconcilingAction(
    variables,
    (datetime) => finishShift({ shiftId: variables.shiftId, location: variables.location, datetime }),
    (original) => findShift(variables.shiftId, original),
  );
}

/** Start a break, reconciling BREAK_ALREADY_ACTIVE against the refetched active break. */
function startBreakReconciling(variables: BreakVariables): Promise<Break> {
  return timedReconcilingAction(
    variables,
    (datetime) => startBreak({ shiftId: variables.shiftId, datetime }),
    async (original) => {
      const active = getActiveBreak(await listBreaks(variables.shiftId));
      if (active) return active;
      throw original;
    },
  );
}

/** End the break, reconciling BREAK_NOT_ACTIVE against the refetched most-recent break. */
function endBreakReconciling(variables: BreakVariables): Promise<Break> {
  return timedReconcilingAction(
    variables,
    (datetime) => endBreak({ shiftId: variables.shiftId, datetime }),
    async (original) => {
      // BREAK_NOT_ACTIVE means the break we wanted to end is already closed. The
      // most recent break is that one; return it so the UI reflects the truth.
      const breaks = await listBreaks(variables.shiftId);
      const latest = breaks.at(-1);
      if (latest) return latest;
      throw original;
    },
  );
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve the cache immediately and still try the network. Without this,
        // queries fail fast when offline instead of showing what we last knew.
        networkMode: 'offlineFirst',
        retry: retryOnlyTransport,
        staleTime: LIST_STALE_TIME_MS,
        gcTime: PERSISTED_CACHE_TTL_MS,
      },
      mutations: {
        // Left as the default 'online' deliberately: a clock-in made with no
        // signal should pause and replay, not fail in the user's face.
        retry: retryOnlyTransport,
      },
    },
  });

  // Paused mutations are restored from storage without their function or their
  // per-call callbacks, so BOTH the mutationFn and the cache write have to live
  // here - a mutation that acts offline, is persisted, and resumes on the next
  // cold start would otherwise succeed on the server while the cache still showed
  // the old state. The shared scope serialises shift mutations so only one runs at
  // a time, and in the order they were queued.
  client.setMutationDefaults(shiftKeys.start(), {
    mutationFn: startShiftReconciling,
    scope: SHIFT_MUTATION_SCOPE,
    onSuccess: (shift) => applyShift(client, shift as Shift),
  });

  client.setMutationDefaults(shiftKeys.finish(), {
    mutationFn: finishShiftReconciling,
    scope: SHIFT_MUTATION_SCOPE,
    // The server auto-closes the open break on finish, so invalidate breaks too -
    // otherwise the UI could show a stale "on break" after clock-out.
    onSuccess: (shift) => applyShift(client, shift as Shift, { invalidateBreaks: true }),
  });

  client.setMutationDefaults(shiftKeys.startBreak(), {
    mutationFn: startBreakReconciling,
    scope: SHIFT_MUTATION_SCOPE,
    onSuccess: (brk) => applyBreak(client, brk as Break),
  });

  client.setMutationDefaults(shiftKeys.endBreak(), {
    mutationFn: endBreakReconciling,
    scope: SHIFT_MUTATION_SCOPE,
    onSuccess: (brk) => applyBreak(client, brk as Break),
  });

  return client;
}

/**
 * Write the server's shift into the cached list so the UI flips immediately, then
 * reconcile in the background. Shared by the live mutation and the resumed-from-disk
 * one so they cannot drift. Clock-out also invalidates the breaks it auto-closed.
 */
function applyShift(client: QueryClient, shift: Shift, opts?: { invalidateBreaks: boolean }): void {
  client.setQueryData<Shift[]>(shiftKeys.list(), (current) =>
    current?.map((candidate) => (candidate.id === shift.id ? shift : candidate)),
  );
  void client.invalidateQueries({ queryKey: shiftKeys.list() });
  if (opts?.invalidateBreaks) {
    void client.invalidateQueries({ queryKey: shiftKeys.breaks(shift.id) });
  }
}

/**
 * Write the break straight into the breaks cache so an offline "on break" survives
 * a cold reopen without waiting for a fetch that cannot happen. Covers both start
 * (append) and end (replace with the closed break), then reconciles in the background.
 */
function applyBreak(client: QueryClient, brk: Break): void {
  client.setQueryData<Break[]>(shiftKeys.breaks(brk.shiftId), (current) => {
    const list = current ?? [];
    return list.some((b) => b.id === brk.id)
      ? list.map((b) => (b.id === brk.id ? brk : b))
      : [...list, brk];
  });
  void client.invalidateQueries({ queryKey: shiftKeys.breaks(brk.shiftId) });
}

export function useShifts() {
  return useQuery({
    queryKey: shiftKeys.list(),
    queryFn: listShifts,
  });
}

/** The breaks for a shift, fetched only while the shift is live (started, not finished). */
export function useBreaks(shiftId: string, enabled: boolean) {
  return useQuery({
    queryKey: shiftKeys.breaks(shiftId),
    queryFn: () => listBreaks(shiftId),
    enabled,
  });
}

// mutationFn, scope, and onSuccess all come from setMutationDefaults, so the live
// path and the resumed-from-disk path are the same code. The generics are explicit
// because that registry is invisible to the type system.
export function useStartShift() {
  return useMutation<Shift, Error, StartShiftVariables>({ mutationKey: shiftKeys.start() });
}

export function useFinishShift() {
  return useMutation<Shift, Error, FinishShiftVariables>({ mutationKey: shiftKeys.finish() });
}

export function useStartBreak() {
  return useMutation<Break, Error, BreakVariables>({ mutationKey: shiftKeys.startBreak() });
}

export function useEndBreak() {
  return useMutation<Break, Error, BreakVariables>({ mutationKey: shiftKeys.endBreak() });
}
