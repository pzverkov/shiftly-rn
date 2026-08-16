import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ErrorFallback } from './ErrorFallback';
import { submitReport } from '../telemetry/report';

jest.mock('../telemetry/report', () => ({
  submitReport: jest.fn(),
}));

// Button drives Reanimated, whose worklet runtime does not exist under jest and
// is irrelevant to this screen's logic. Stand in with a plain touchable.
jest.mock('./Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

const mockedSubmit = jest.mocked(submitReport);

function renderFallback(resetErrorBoundary = jest.fn()) {
  return render(
    <ErrorFallback error={new Error('boom')} resetErrorBoundary={resetErrorBoundary} />,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('ErrorFallback', () => {
  it('shows a friendly message instead of the technical error', async () => {
    await renderFallback();

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    // The raw error text must never reach the user.
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('retries by resetting the boundary', async () => {
    const reset = jest.fn();
    await renderFallback(reset);

    fireEvent.press(screen.getByText('Try again'));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('confirms once a report has been sent', async () => {
    mockedSubmit.mockResolvedValue({ ok: true, reference: 'R-1' });
    await renderFallback();

    await act(async () => {
      fireEvent.press(screen.getByText('Send a report'));
    });

    await waitFor(() => expect(screen.getByText('Thanks - the team has been notified.')).toBeTruthy());
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failure to send without crashing', async () => {
    mockedSubmit.mockResolvedValue({ ok: false, reference: 'R-2' });
    await renderFallback();

    await act(async () => {
      fireEvent.press(screen.getByText('Send a report'));
    });

    await waitFor(() =>
      expect(screen.getByText("Couldn't send the report. Please try again.")).toBeTruthy(),
    );
  });
});
