const { ERRORS } = require('../common/api-error.pure');

const MINUTE = 60 * 1000;
const SHIFT_START_WINDOW_MINUTES = 15;
const SHIFT_FINISH_GRACE_MINUTES = 30;
const MIN_MINUTES_BEFORE_BREAK = 2;
const MIN_MINUTES_BREAK_DURATION = 2;
const MAX_BREAKS_PER_SHIFT = 2;
const SHIFT_MAX_DISTANCE_METERS = 50;
const EARTH_RADIUS_METERS = 6_371_000;

function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function assertWithinBranchRange(branch, location) {
  if (!location) {
    throw ERRORS.VALIDATION_ERROR('"location" is required to clock in or out.');
  }
  if (!branch?.location) return;
  const distance = distanceMeters(branch.location, location);
  if (distance > SHIFT_MAX_DISTANCE_METERS) {
    throw ERRORS.SHIFT_OUT_OF_RANGE({
      distanceMeters: Math.round(distance),
      maxDistanceMeters: SHIFT_MAX_DISTANCE_METERS,
    });
  }
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isPastFinishDeadline(shift, now) {
  const end = new Date(shift.endDate).getTime();
  return now.getTime() > end + SHIFT_FINISH_GRACE_MINUTES * MINUTE;
}

function shiftIsFinished(shift, now) {
  if (shift.finishedAt) return true;
  return isPastFinishDeadline(shift, now);
}

function assertCanStartShift(shift, now, location) {
  if (shift.startedAt) throw ERRORS.SHIFT_ALREADY_STARTED();
  if (shiftIsFinished(shift, now)) throw ERRORS.SHIFT_ALREADY_FINISHED();

  const start = new Date(shift.startDate);
  if (!isSameLocalDay(now, start)) throw ERRORS.SHIFT_WRONG_DAY();

  const earliestStart = start.getTime() - SHIFT_START_WINDOW_MINUTES * MINUTE;
  if (now.getTime() < earliestStart) {
    const minutesUntilWindow = Math.ceil((earliestStart - now.getTime()) / MINUTE);
    throw ERRORS.SHIFT_START_TOO_EARLY(minutesUntilWindow);
  }

  assertWithinBranchRange(shift.branch, location);
}

function assertCanFinishShift(shift, now, location) {
  if (!shift.startedAt) throw ERRORS.SHIFT_NOT_STARTED();
  if (shift.finishedAt) throw ERRORS.SHIFT_ALREADY_FINISHED();

  if (isPastFinishDeadline(shift, now)) {
    throw ERRORS.SHIFT_FINISH_TOO_LATE();
  }

  assertWithinBranchRange(shift.branch, location);
}

function assertCanStartBreak(shift, breaks, activeBreak, now) {
  if (!shift.startedAt) throw ERRORS.SHIFT_NOT_STARTED();
  if (shift.finishedAt) throw ERRORS.SHIFT_ALREADY_FINISHED();
  if (activeBreak) throw ERRORS.BREAK_ALREADY_ACTIVE();
  if (breaks.length >= MAX_BREAKS_PER_SHIFT) throw ERRORS.BREAK_LIMIT_REACHED();

  const minBreakAt =
    new Date(shift.startedAt).getTime() + MIN_MINUTES_BEFORE_BREAK * MINUTE;
  if (now.getTime() < minBreakAt) throw ERRORS.BREAK_TOO_SOON_AFTER_START();
}

function assertCanEndBreak(activeBreak, now) {
  if (!activeBreak) throw ERRORS.BREAK_NOT_ACTIVE();

  const earliestEnd =
    new Date(activeBreak.startedAt).getTime() + MIN_MINUTES_BREAK_DURATION * MINUTE;
  if (now.getTime() < earliestEnd) throw ERRORS.BREAK_END_TOO_SOON();
}

module.exports = {
  assertCanStartShift,
  assertCanFinishShift,
  assertCanStartBreak,
  assertCanEndBreak,
};
