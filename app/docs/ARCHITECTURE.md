# Architecture

How Shiftly's client is built, and why the load-bearing parts are shaped the way they
are. For "what does the app do", see the [README](../README.md); this is "how, and why
this way" for anyone about to change it.

## Layers

```
UI (src/features, src/ui)
  -> React Query data layer (src/api) - owns the offline queue and persistence
    -> pure domain layer (src/domain) - the shift/break rules, no I/O
      -> platform adapters (src/location, src/time, src/i18n)
```

The API re-checks every rule the domain layer enforces client-side. The API is the
authority; the client mirrors its rules only so the UI never offers an action the API
would reject.

## Shift rules are mirrored, not shared, and pinned by a differential test

The window rules live in two places: `api/src/shifts/shifts-rules.pure.js` (the
authority, which throws) and the client's `src/domain/shift.ts` / `breaks.ts` (which
derive UI state). They are written in different languages in different projects, so
nothing stops them drifting apart except a test that would catch it.

`src/domain/shift.contract.test.ts` imports the real API rules module directly
(`require('../../../api/src/shifts/shifts-rules.pure.js')`) and sweeps a full shift,
minute by minute, asserting the client and the API agree at every point. If either
side's constants or logic change without the other, this test fails in CI instead of a
user discovering the disagreement in production. The pure rules module stays plain,
un-decorated CommonJS specifically so this cross-project `require()` works without a
build step (see `api/README.md`'s layout section).

The API itself sits behind a `ShiftsRepository` abstraction (a DI token, not a concrete
class), so its backing store can move off the current in-memory implementation without
touching the controller or this contract test. Every mutating request is also recorded
in a tamper-evident, hash-chained audit log via an interceptor with no dependency on
shift-specific types - see `api/README.md`'s Architecture and Audit trail sections for
both.

## The API clock is not trusted, and neither is a bare device clock

Clock-in is payroll-adjacent, so *when* it was recorded matters, and device clocks are
both commonly wrong (a dead battery reboots to a bogus time) and deliberately
spoofable.

- `serverNow()` (`src/time/serverClock.ts`) samples the `Date` response header on every
  request and keeps the offset, so the countdown that unlocks the clock-in button is
  correct even on a skewed device.
- A **live** clock-in sends no `datetime` at all - the API stamps its own clock.
  Nothing the device does to its clock or timezone can move the recorded time.
- Only a **delayed offline replay** sends a client-captured time, because by the time
  it replays, the API's clock-at-replay would record the wrong moment. That captured
  time is anchored to `serverNow()` at the moment of the tap and persisted with the
  queued mutation so it survives a cold start.
- Live vs. replay is classified using the **raw device clock** delta since the press,
  not `serverNow()` - the offset can shift between press and submit across a cold
  start, which would otherwise misclassify a live clock-in as a replay and reject it.
- The residual gap: a rooted device could still forge the one timestamp an offline
  replay sends. No client-side check fully closes that; the complete fix is a
  server-signed or fully server-authoritative scheme, which is outside this client's
  scope. A tamper-proof audit log was deliberately not built client-side for the same
  reason - it only means anything when the trusted party (the API) writes it, which is
  exactly what `api/`'s audit log does instead.

## Location is an acquisition ladder, not one call

`expo-location`'s `getCurrentPositionAsync` has no timeout and can hang for tens of
seconds indoors or under battery saver - exactly where a clock-in happens.
`src/location/acquire.ts` instead tries, in order: `getLastKnownPositionAsync`
(near-instant, with an accuracy requirement mirroring the API's 50m geofence), then
`getCurrentPositionAsync` raced against a 10-second timeout, then falls through to a
typed failure (`denied` / `services-off` / `timeout` / `unavailable`), each mapped to
its own actionable message. A coarse fix is still sent rather than withheld - the API
judges distance from the point it receives, and a wide accuracy radius doesn't make the
point wrong - but if the API does reject it, the UI blames accuracy rather than telling
someone standing in the kitchen they're too far from the branch.

Phone "location" is OS-fused positioning (GPS, WiFi access-point lookup, cell towers,
and where deployed, Bluetooth beacons) behind one API - indoors it's usually a WiFi/cell
fix, not GPS, which is why the ladder accepts a coarse point rather than forcing a GPS
lock that can stall in a basement kitchen. This needs no native module: `expo-location`
already calls the same OS location APIs a hand-rolled native module would.

## Errors are classified into three buckets, not caught generically

The API has 14 error codes (see `api/README.md`'s business-rules table).
`src/api/errors.ts` sorts them into:

| Bucket | Codes | Behavior |
|---|---|---|
| `retryable` | network, timeout, 5xx | Retried with backoff. Nothing else retries. |
| `reconcile` | `SHIFT_ALREADY_STARTED`, `SHIFT_ALREADY_FINISHED`, `BREAK_ALREADY_ACTIVE`, `BREAK_NOT_ACTIVE` | Not a failure - the cache is stale and the API already agrees with the user. Refetch and show success. |
| `terminal` | the other 10 | A localized message keyed by the error code. Never retried - retrying a genuine business rejection is wrong. |

The `reconcile` bucket is what makes retrying `POST /start` safe: a duplicate is
answered with `SHIFT_ALREADY_STARTED` rather than a second clock-in, so the endpoint is
effectively idempotent. The reconcile check lives inside the mutation function itself,
so an offline replay - where a duplicate is most likely - gets the same treatment as a
live request.

## Offline: one mutation scope serializes the four writes

Clock-in, clock-out, break-start, and break-end can all be queued offline and replayed
later, and some depend on order - clock-out auto-closes an open break, so a
break-then-clock-out queued in that order must replay in that order. All four share one
TanStack Query mutation `scope` (`shift-mutation`), which runs scoped mutations one at
a time, FIFO. That serializes offline replay in order and stops a double-tap from
firing a second, conflicting write while the first is in flight; every action button on
the live card is disabled while any write is pending or paused.

Mutations pause offline, persist to `AsyncStorage` via
`@tanstack/react-query-persist-client`, and resume on reconnect (`onlineManager` wired
to `NetInfo`). Queries run `offlineFirst`, so opening the app offline shows the last
known shifts behind a banner instead of an error screen. The offline queue is surfaced
at three altitudes - an inline "saved offline" notice at the point of the tap, a
per-card chip ("Syncing" -> a self-clearing "Synced"), and a global banner counting
everything still in flight - all three read the same mutation cache, so none of them
can disagree with what will actually replay.

## Testing philosophy

Effort concentrates on what's likely to be wrong and unlikely to be noticed by
inspection: the differential contract test above; the error-taxonomy table; the
transport layer (timeout that covers the full response body, not just headers;
error-envelope clock sampling; retry-bucket mapping); the location ladder's failure
modes; a full cold-start offline round trip (dehydrate a paused mutation to
`AsyncStorage`, throw the client away, rehydrate, go online, assert it replays and
writes the cache); the adaptive countdown tick's fast/slow switch and render-count; and
i18n key-parity across locales. Several of these tests exist because independent review
passes found real bugs first - a timeout that didn't cover the response body, a resumed
mutation that lost its cache write, a "synced" confirmation firing on a rejected write -
each pinned with a regression test.

## Region-aware i18n

Language (`en` / `he`) picks the translation dictionary; region picks a formatting
profile - locale tag, 12h/24h clock, metric/imperial units. `en-US` gets a 12-hour
clock and feet; `en-GB` and `he-IL` get 24-hour and metres; `en-US` and `en-GB` share
one English dictionary since the copy itself is region-neutral. Distance renders
through a `formatDistance` helper backed by a `units` translation namespace (not `Intl`
unit formatting, which is unreliable on Hermes/Android) - the API's 50-metre geofence
stays metric internally; feet are display-only. Hebrew exists specifically to exercise
RTL against the LTR default and prove the layouts carry no hardcoded `left`/`right`.
