const { ApiError, ERRORS } = require('./api-error.pure');

describe('ApiError', () => {
  it('serialises to the documented envelope, details included when present', () => {
    const err = ERRORS.SHIFT_OUT_OF_RANGE({ distanceMeters: 80, maxDistanceMeters: 50 });
    expect(err.toJSON()).toEqual({
      error: {
        code: 'SHIFT_OUT_OF_RANGE',
        message: 'You must be within 50 metres of the branch to clock in or out.',
        details: { distanceMeters: 80, maxDistanceMeters: 50 },
      },
    });
  });

  it('omits the details key entirely when there are none', () => {
    const err = ERRORS.SHIFT_ALREADY_STARTED();
    expect(err.toJSON()).toEqual({
      error: { code: 'SHIFT_ALREADY_STARTED', message: 'This shift has already been started.' },
    });
  });

  it('carries the right HTTP status per error', () => {
    expect(ERRORS.SHIFT_NOT_FOUND('x').status).toBe(404);
    expect(ERRORS.VALIDATION_ERROR('bad').status).toBe(400);
    expect(ERRORS.BREAK_END_TOO_SOON().status).toBe(409);
  });

  it('is a real Error instance', () => {
    expect(ERRORS.SHIFT_NOT_STARTED()).toBeInstanceOf(Error);
    expect(ERRORS.SHIFT_NOT_STARTED()).toBeInstanceOf(ApiError);
  });
});
