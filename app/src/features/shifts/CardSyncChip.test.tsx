import { render, screen } from '@testing-library/react-native';

import { CardSyncChip } from './CardSyncChip';

jest.mock('../../api/syncStatus', () => ({
  useCardSyncState: jest.fn(),
  useSyncedPulse: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, FadeIn: {}, FadeOut: {} };
});

const { useCardSyncState, useSyncedPulse } = require('../../api/syncStatus');

function setState(state: string, justSynced = false) {
  useCardSyncState.mockReturnValue(state);
  useSyncedPulse.mockReturnValue(justSynced);
}

describe('CardSyncChip', () => {
  it('shows the syncing chip while a write is on the wire', async () => {
    setState('syncing');
    await render(<CardSyncChip shiftId="shift-1" />);
    expect(screen.getByText('Syncing')).toBeTruthy();
  });

  it('shows the synced confirmation when the queue drains', async () => {
    setState('idle', true);
    await render(<CardSyncChip shiftId="shift-1" />);
    expect(screen.getByText(/Synced/)).toBeTruthy();
  });

  it('stays silent while queued - the action notice already carries that, not the chip', async () => {
    setState('queued', false);
    await render(<CardSyncChip shiftId="shift-1" />);
    expect(screen.toJSON()).toBeNull();
  });

  it('renders nothing at rest', async () => {
    setState('idle', false);
    await render(<CardSyncChip shiftId="shift-1" />);
    expect(screen.toJSON()).toBeNull();
  });
});
