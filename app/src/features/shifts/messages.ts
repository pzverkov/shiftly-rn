import { ApiError, NetworkError, type ApiErrorCode } from '../../api/errors';
import {
  MIN_MINUTES_BEFORE_BREAK,
  MIN_MINUTES_BREAK_DURATION,
} from '../../domain/breaks';
import {
  SHIFT_FINISH_GRACE_MINUTES,
  SHIFT_MAX_DISTANCE_METERS,
  SHIFT_START_WINDOW_MINUTES,
} from '../../domain/shift';
import { t } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { LocationFix, LocationResult } from '../../location/acquire';
import { formatDistance } from './format';

/**
 * Turning failures into something a user can act on.
 *
 * Kept pure and separate from the components so the wording is testable and lives
 * in one place. Copy comes from the i18n layer, including the business rejections:
 * the server sends a code and an English `message`, and we say the code in the
 * user's language (see `localizeApiError`) rather than surface the English text.
 */

/** Each business-rejection code to its localised line. Total over the code union. */
const SERVER_ERROR_KEY: Record<ApiErrorCode, TranslationKey> = {
  VALIDATION_ERROR: 'serverError.validation',
  SHIFT_NOT_FOUND: 'serverError.notFound',
  SHIFT_WRONG_DAY: 'serverError.wrongDay',
  SHIFT_START_TOO_EARLY: 'serverError.startTooEarly',
  SHIFT_ALREADY_STARTED: 'serverError.alreadyStarted',
  SHIFT_ALREADY_FINISHED: 'serverError.alreadyFinished',
  SHIFT_NOT_STARTED: 'serverError.notStarted',
  SHIFT_FINISH_TOO_LATE: 'serverError.finishTooLate',
  SHIFT_OUT_OF_RANGE: 'serverError.outOfRange',
  BREAK_TOO_SOON_AFTER_START: 'serverError.breakTooSoon',
  BREAK_LIMIT_REACHED: 'serverError.breakLimit',
  BREAK_ALREADY_ACTIVE: 'serverError.breakAlreadyActive',
  BREAK_NOT_ACTIVE: 'serverError.breakNotActive',
  BREAK_END_TOO_SOON: 'serverError.breakEndTooSoon',
};

/**
 * The rule thresholds the copy quotes, fed in rather than written into the strings.
 * Spelling "15 minutes" into the translation means changing the constant leaves the
 * user-facing line quietly lying, in every language, with nothing to catch it.
 */
const SERVER_ERROR_PARAMS: Partial<Record<ApiErrorCode, Record<string, number>>> = {
  SHIFT_START_TOO_EARLY: { minutes: SHIFT_START_WINDOW_MINUTES },
  SHIFT_FINISH_TOO_LATE: { minutes: SHIFT_FINISH_GRACE_MINUTES },
  BREAK_TOO_SOON_AFTER_START: { minutes: MIN_MINUTES_BEFORE_BREAK },
  BREAK_END_TOO_SOON: { minutes: MIN_MINUTES_BREAK_DURATION },
};

/**
 * The localised line for a business rejection. Falls back to the server's own
 * `message` for a code the client does not know yet - a new server rule ships its
 * English text rather than nothing, until a key is added here.
 */
function localizeApiError(error: ApiError): string {
  const key = SERVER_ERROR_KEY[error.code] as TranslationKey | undefined;
  return key ? t(key, SERVER_ERROR_PARAMS[error.code]) : error.message;
}

export type Advice = {
  title: string;
  detail: string;
  /** Whether pressing clock-in again could plausibly help. */
  canRetry: boolean;
  /**
   * A recovery the user can take that a retry cannot. `openSettings` deep-links to
   * the OS settings for the cases only reachable there (permission blocked, location
   * services off).
   */
  action?: 'openSettings';
};

export function describeLocationFailure(
  result: Exclude<LocationResult, { kind: 'ok' }>,
): Advice {
  switch (result.kind) {
    case 'denied':
      // Can ask again -> in-app retry re-prompts. Blocked -> only Settings recovers.
      return result.canAskAgain
        ? {
            title: t('advice.deniedTitle'),
            detail: t('advice.deniedDetailAskable'),
            canRetry: true,
          }
        : {
            title: t('advice.deniedTitle'),
            detail: t('advice.deniedDetailSettings'),
            canRetry: false,
            action: 'openSettings',
          };
    case 'services-off':
      return {
        title: t('advice.servicesOffTitle'),
        detail: t('advice.servicesOffDetail'),
        canRetry: true,
        action: 'openSettings',
      };
    case 'timeout':
      return {
        title: t('advice.timeoutTitle'),
        detail: t('advice.timeoutDetail'),
        canRetry: true,
      };
    case 'unavailable':
      // The platform's own message (result.message) is English and technical, so it
      // goes to the log, not the user; the user sees a translated line.
      return {
        title: t('advice.unavailableTitle'),
        detail: t('advice.unavailableDetail'),
        canRetry: true,
      };
  }
}

/**
 * The interesting case is SHIFT_OUT_OF_RANGE.
 *
 * The server measures the distance from the single point we sent it and knows
 * nothing about how confident that point was. So the same rejection has two very
 * different meanings: either the user really is down the road, or we handed the
 * server a fix with a 150m error radius and it landed outside the geofence by
 * accident. Telling someone standing in the kitchen "you're too far from Soho" is
 * both wrong and unactionable, so a coarse fix gets its own message.
 */
export function describeClockInFailure(error: unknown, fix: LocationFix | null): Advice {
  if (error instanceof NetworkError) {
    return {
      title: t('advice.noConnectionTitle'),
      detail: t('advice.noConnectionDetail'),
      canRetry: false,
    };
  }

  if (!(error instanceof ApiError)) {
    return {
      title: t('advice.genericTitle'),
      detail: t('advice.genericDetail'),
      canRetry: true,
    };
  }

  if (error.code === 'SHIFT_OUT_OF_RANGE' && fix?.isCoarse) {
    return {
      title: t('advice.coarseTitle'),
      // `accuracy` is metres; formatDistance renders it in the active region's units.
      detail: fix.accuracy !== null
        ? t('advice.coarseDetailWithAccuracy', { accuracy: formatDistance(fix.accuracy) })
        : t('advice.coarseDetailNoAccuracy'),
      canRetry: true,
    };
  }

  if (error.code === 'SHIFT_OUT_OF_RANGE') {
    const distance = error.details?.distanceMeters;
    return {
      title: t('advice.tooFarTitle'),
      detail:
        typeof distance === 'number'
          ? t('advice.tooFarDetailWithDistance', {
              distance: formatDistance(distance),
              limit: formatDistance(SHIFT_MAX_DISTANCE_METERS),
            })
          : localizeApiError(error),
      canRetry: true,
    };
  }

  // Every other business rejection is said in the user's language, keyed by its code.
  return {
    title: t('advice.cannotTitle'),
    detail: localizeApiError(error),
    canRetry: false,
  };
}

/**
 * Break start/end failures. No location is involved, so this is simpler than the
 * clock-in case: a lost connection is framed as queued (the mutation pauses and
 * replays), and every business rejection - too soon, both breaks used, minimum
 * duration - is said in the user's language, keyed by its code.
 */
export function describeBreakFailure(error: unknown): Advice {
  if (error instanceof NetworkError) {
    return {
      title: t('advice.noConnectionTitle'),
      detail: t('advice.breakOfflineDetail'),
      canRetry: false,
    };
  }

  if (!(error instanceof ApiError)) {
    return {
      title: t('advice.genericTitle'),
      detail: t('advice.genericDetail'),
      canRetry: true,
    };
  }

  return {
    title: t('advice.breakFailedTitle'),
    detail: localizeApiError(error),
    canRetry: false,
  };
}
