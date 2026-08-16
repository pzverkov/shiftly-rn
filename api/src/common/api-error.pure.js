class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

const ERRORS = {
  VALIDATION_ERROR: (msg, details) =>
    new ApiError(400, 'VALIDATION_ERROR', msg, details),
  SHIFT_NOT_FOUND: (id) =>
    new ApiError(404, 'SHIFT_NOT_FOUND', `Shift "${id}" does not exist.`),

  SHIFT_WRONG_DAY: () =>
    new ApiError(
      409,
      'SHIFT_WRONG_DAY',
      'A shift can only be started on the day it is scheduled for.',
    ),
  SHIFT_START_TOO_EARLY: (minutesUntilWindow) =>
    new ApiError(
      409,
      'SHIFT_START_TOO_EARLY',
      'A shift can only be started up to 15 minutes before its scheduled start.',
      { minutesUntilWindow },
    ),
  SHIFT_ALREADY_STARTED: () =>
    new ApiError(409, 'SHIFT_ALREADY_STARTED', 'This shift has already been started.'),
  SHIFT_ALREADY_FINISHED: () =>
    new ApiError(409, 'SHIFT_ALREADY_FINISHED', 'This shift has already been finished.'),
  SHIFT_NOT_STARTED: () =>
    new ApiError(409, 'SHIFT_NOT_STARTED', 'This shift has not been started yet.'),
  SHIFT_FINISH_TOO_LATE: () =>
    new ApiError(
      409,
      'SHIFT_FINISH_TOO_LATE',
      'A shift can no longer be finished more than 30 minutes after its scheduled end.',
    ),
  SHIFT_OUT_OF_RANGE: (details) =>
    new ApiError(
      409,
      'SHIFT_OUT_OF_RANGE',
      'You must be within 50 metres of the branch to clock in or out.',
      details,
    ),

  BREAK_TOO_SOON_AFTER_START: () =>
    new ApiError(
      409,
      'BREAK_TOO_SOON_AFTER_START',
      'You must wait at least 2 minutes after starting your shift before taking a break.',
    ),
  BREAK_LIMIT_REACHED: () =>
    new ApiError(
      409,
      'BREAK_LIMIT_REACHED',
      'You have already taken the maximum of 2 breaks for this shift.',
    ),
  BREAK_ALREADY_ACTIVE: () =>
    new ApiError(409, 'BREAK_ALREADY_ACTIVE', 'You are already on a break.'),
  BREAK_NOT_ACTIVE: () =>
    new ApiError(409, 'BREAK_NOT_ACTIVE', 'You are not currently on a break.'),
  BREAK_END_TOO_SOON: () =>
    new ApiError(
      409,
      'BREAK_END_TOO_SOON',
      'A break must last at least 2 minutes before it can be ended.',
    ),
};

module.exports = { ApiError, ERRORS };
