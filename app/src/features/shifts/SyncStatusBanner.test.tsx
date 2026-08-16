import { render, screen } from '@testing-library/react-native';

import { SyncStatusBanner } from './SyncStatusBanner';

// The lifecycle branching is the logic under test; the mutation-cache reads it
// stands on are covered in syncStatus.test.ts. Mock the two derivation hooks so
// each state is exercised deterministically without staging real mutations.
jest.mock('../../api/syncStatus', () => ({
  useQueueSummary: jest.fn(),
  useSyncedPulse: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, FadeIn: {}, FadeOut: {} };
});

const { useQueueSummary, useSyncedPulse } = require('../../api/syncStatus');

function setState({ queued = 0, syncing = 0, justSynced = false }) {
  useQueueSummary.mockReturnValue({ queued, syncing });
  useSyncedPulse.mockReturnValue(justSynced);
}

describe('SyncStatusBanner', () => {
  it('shows in-flight progress with a count while syncing, over every other state', async () => {
    // Still nominally offline and a queue behind it, but progress wins the banner.
    setState({ queued: 1, syncing: 2, justSynced: false });
    await render(<SyncStatusBanner isOffline />);
    expect(screen.getByText('Back online. Syncing 2 actions...')).toBeTruthy();
  });

  it('uses the singular copy for one in-flight action', async () => {
    setState({ syncing: 1 });
    await render(<SyncStatusBanner isOffline={false} />);
    expect(screen.getByText('Back online. Syncing 1 action...')).toBeTruthy();
  });

  it('shows the self-clearing synced confirmation once the queue drains', async () => {
    setState({ justSynced: true });
    await render(<SyncStatusBanner isOffline={false} />);
    expect(screen.getByText("All caught up. You're back online and everything synced.")).toBeTruthy();
  });

  it('shows the queued count while offline', async () => {
    setState({ queued: 3 });
    await render(<SyncStatusBanner isOffline />);
    expect(
      screen.getByText("You're offline. 3 actions are saved and will sync when you're back."),
    ).toBeTruthy();
  });

  it('falls back to the plain offline line when nothing is queued', async () => {
    setState({});
    await render(<SyncStatusBanner isOffline />);
    expect(screen.getByText("You're offline. Showing your last known shifts.")).toBeTruthy();
  });

  it('renders nothing when online with an empty, settled queue', async () => {
    setState({});
    await render(<SyncStatusBanner isOffline={false} />);
    expect(screen.toJSON()).toBeNull();
  });
});
