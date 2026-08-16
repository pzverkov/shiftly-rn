import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { createElement, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { createQueryClient } from '../../api/queries';
import { makeShift } from '../../domain/testFixtures';
import { ClockInAction } from './ClockInAction';

/**
 * The permission-to-UI wiring, which the unit tests do not reach.
 *
 * `acquireLocation` is covered in acquire.test.ts and the advice copy in
 * messages.test.ts, but the load-bearing integration is here: a clock-in must NOT
 * fire without a location, a blocked permission must offer the one recovery that
 * works (Open Settings), and a granted fix must actually send the point.
 */

jest.mock('expo-location');

// The dev override short-circuits location acquisition with the branch coordinates,
// and it defaults on under __DEV__. Force it off so this exercises the real path.
jest.mock('../../location/devOverride', () => ({
  isDevLocationOverrideEnabled: () => false,
  useDevLocationOverride: () => [false, jest.fn()],
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Reanimated's worklets runtime does not exist under jest (see ActiveShiftActions.test).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    FadeIn: {},
    FadeOut: {},
    LinearTransition: {},
  };
});

// Button drives Reanimated; stand in with a plain touchable that exposes its label.
jest.mock('../../ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
      testID,
    }: {
      label: string;
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Pressable testID={testID} onPress={onPress} accessibilityState={{ disabled: !!disabled }}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

const mockedLocation = jest.mocked(Location);
const SOHO = { latitude: 51.5142, longitude: -0.1316 };

function position(accuracy: number | null = 10): Location.LocationObject {
  return {
    coords: { ...SOHO, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: 0,
  } as Location.LocationObject;
}

function granted(canAskAgain = true) {
  return { granted: true, canAskAgain, status: 'granted', expires: 'never' } as never;
}

function denied(canAskAgain: boolean) {
  return { granted: false, canAskAgain, status: 'denied', expires: 'never' } as never;
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => new Date().toUTCString() },
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn();
let client: ReturnType<typeof createQueryClient>;

const SHIFT = makeShift({ id: 's1', startDate: '2026-07-16T14:00:00.000Z' });

async function renderAction() {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(<ClockInAction shift={SHIFT} state={{ kind: 'clock-in-open' }} />, { wrapper });
}

async function pressClockIn() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('clock-in-button'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  client = createQueryClient();

  mockedLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue(granted());
  mockedLocation.getLastKnownPositionAsync.mockResolvedValue(null);
  mockedLocation.getCurrentPositionAsync.mockResolvedValue(position());
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

afterEach(() => {
  client.getQueryCache().getAll().forEach((q) => q.destroy());
  client.getMutationCache().getAll().forEach((m) => m.destroy());
  client.clear();
});

describe('ClockInAction permission wiring', () => {
  it('fires the clock-in with the acquired location once a fix is granted', async () => {
    fetchMock.mockResolvedValue(okResponse({ shift: { ...SHIFT, startedAt: '2026-07-16T13:50:00.000Z' } }));

    await renderAction();
    await pressClockIn();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain('/shifts/s1/start');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).location).toEqual({
      lat: SOHO.latitude,
      lng: SOHO.longitude,
    });
    // Nothing to recover from, so no Settings escape hatch.
    expect(screen.queryByText('Open Settings')).toBeNull();
  });

  it('does not clock in and offers Open Settings when permission is blocked for good', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue(denied(false));

    await renderAction();
    await pressClockIn();

    // The recovery that actually works when a retry cannot re-prompt.
    await screen.findByText('Open Settings');
    // The safety-critical guarantee: no location, no clock-in.
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Open Settings'));
    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('does not clock in and offers Open Settings when location services are off', async () => {
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(false);

    await renderAction();
    await pressClockIn();

    await screen.findByText('Open Settings');
    expect(fetchMock).not.toHaveBeenCalled();
    // A permission dialog can't fix services being off, so we never asked for one.
    expect(mockedLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('shows advice but no Open Settings when permission can still be asked, and does not clock in', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue(denied(true));

    await renderAction();
    await pressClockIn();

    await screen.findByText('Location permission needed');
    // Askable refusal recovers with an in-app retry, not a Settings detour.
    expect(screen.queryByText('Open Settings')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
