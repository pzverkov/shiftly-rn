import type { UseMutationResult } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { announce } from '../../a11y/announce';
import type { BreakVariables, LocatedActionVariables } from '../../api/shifts';
import type { Break } from '../../domain/breaks';
import type { Shift } from '../../domain/shift';
import { acquireLocation, type LocationFix } from '../../location/acquire';
import { isDevLocationOverrideEnabled } from '../../location/devOverride';
import { reportError } from '../../telemetry/report';
import { serverNow } from '../../time/serverClock';
import { describeBreakFailure, describeClockInFailure, describeLocationFailure, type Advice } from './messages';

/**
 * The shared plumbing behind every shift action: capture the press timestamps,
 * derive the failure advice from the mutation (never a per-call callback, which is
 * dropped if the card unmounts mid-request), and announce the outcome with a
 * haptic for a screen reader that would otherwise get no feedback.
 *
 * `useLocatedClockAction` covers clock-in and clock-out (both geofenced); breaks
 * use `useBreakAction`, which is the same minus the location ladder.
 */

export type ClockAction = {
  onPress: () => void;
  /** True while acquiring a location or the mutation is in flight. */
  busy: boolean;
  /** Only set for located actions, while the GPS fix is being read. */
  acquiringLocation: boolean;
  advice: Advice | null;
  isPaused: boolean;
};

/** Announce a message once per distinct string, with a matching haptic. */
function useAnnounceOnce(message: string | null, type: Haptics.NotificationFeedbackType) {
  useEffect(() => {
    if (message) {
      announce(message);
      void Haptics.notificationAsync(type);
    }
    // Keyed on the text so the same advice is not re-spoken every render.
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLocatedClockAction(params: {
  shift: Shift;
  mutation: UseMutationResult<Shift, Error, LocatedActionVariables>;
  successAnnouncement: string;
}): ClockAction {
  const { shift, mutation, successAnnouncement } = params;

  // Only holds location-acquisition failures, which are not mutation errors. The
  // server rejection advice is derived from the mutation state below instead.
  const [locationAdvice, setLocationAdvice] = useState<Advice | null>(null);
  const [acquiringLocation, setAcquiringLocation] = useState(false);

  // Remembered so a SHIFT_OUT_OF_RANGE rejection can be explained in terms of how
  // confident the fix was. See describeClockInFailure. State rather than a ref
  // because it is written in the press handler and *read during render* - a ref read
  // in render is not guaranteed to have re-rendered with the value it now holds.
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);

  const advice: Advice | null =
    locationAdvice ?? (mutation.error ? describeClockInFailure(mutation.error, lastFix) : null);

  useAnnounceOnce(mutation.isSuccess ? successAnnouncement : null, Haptics.NotificationFeedbackType.Success);
  useAnnounceOnce(advice ? `${advice.title}. ${advice.detail}` : null, Haptics.NotificationFeedbackType.Error);

  async function onPress() {
    setLocationAdvice(null);
    mutation.reset();

    // Captured now, before we go looking for a GPS fix. The action happened when
    // the user pressed the button; a slow fix must not backdate it. See queries.ts.
    const pressedAtServerMs = serverNow();
    const pressedAtDeviceMs = Date.now();

    let point = shift.branch.location;
    setLastFix(null);

    if (!isDevLocationOverrideEnabled()) {
      setAcquiringLocation(true);
      let result;
      try {
        result = await acquireLocation();
      } finally {
        // Defence in depth: acquireLocation is total, but never leave the button
        // wedged on its spinner if that ever changes.
        setAcquiringLocation(false);
      }

      if (result.kind !== 'ok') {
        // The platform's raw message is English and technical, so it goes to the
        // log rather than the user, who sees a translated line.
        if (result.kind === 'unavailable') reportError(result.message, 'location-unavailable');
        setLocationAdvice(describeLocationFailure(result));
        return;
      }

      // A coarse fix is still sent: the server checks distance from the point, and
      // a wide error radius does not mean the point is wrong.
      setLastFix(result.fix);
      point = result.fix.point;
    }

    mutation.mutate({ shiftId: shift.id, location: point, pressedAtServerMs, pressedAtDeviceMs });
  }

  return {
    onPress,
    acquiringLocation,
    busy: acquiringLocation || mutation.isPending,
    advice,
    isPaused: mutation.isPaused,
  };
}

export function useBreakAction(params: {
  shiftId: string;
  mutation: UseMutationResult<Break, Error, BreakVariables>;
  successAnnouncement: string;
}): ClockAction {
  const { shiftId, mutation, successAnnouncement } = params;

  const advice: Advice | null = mutation.error ? describeBreakFailure(mutation.error) : null;

  useAnnounceOnce(mutation.isSuccess ? successAnnouncement : null, Haptics.NotificationFeedbackType.Success);
  useAnnounceOnce(advice ? `${advice.title}. ${advice.detail}` : null, Haptics.NotificationFeedbackType.Error);

  function onPress() {
    mutation.reset();
    const pressedAtServerMs = serverNow();
    const pressedAtDeviceMs = Date.now();
    mutation.mutate({ shiftId, pressedAtServerMs, pressedAtDeviceMs });
  }

  return {
    onPress,
    acquiringLocation: false,
    busy: mutation.isPending,
    advice,
    isPaused: mutation.isPaused,
  };
}
