jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { ONE_WEEK_MS, shouldShowSupportModal } from '../../hooks/useSupportModal';

describe('shouldShowSupportModal', () => {
  const now = Date.now();

  it('returns false when disabled', () => {
    expect(shouldShowSupportModal('1', 1, null, now)).toBe(false);
  });

  it('shows for first two launches when not disabled', () => {
    expect(shouldShowSupportModal(null, 1, null, now)).toBe(true);
    expect(shouldShowSupportModal(null, 2, null, now)).toBe(true);
  });

  it('shows after two launches if no previous prompt', () => {
    expect(shouldShowSupportModal(null, 3, null, now)).toBe(true);
  });

  it('shows when more than one week has passed since last prompt', () => {
    expect(shouldShowSupportModal(null, 3, now - ONE_WEEK_MS - 1, now)).toBe(true);
  });

  it('does not show within one week of last prompt', () => {
    expect(shouldShowSupportModal(null, 3, now - ONE_WEEK_MS + 1, now)).toBe(false);
  });
});
