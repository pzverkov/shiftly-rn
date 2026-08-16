// AsyncStorage has no native module under jest; use its official in-memory mock.
// Reached transitively through the i18n and persistence layers.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Pin the ambient locale so the default profile is deterministic on any machine.
// Without this the region-aware resolver (src/i18n) would pick up the CI/dev
// machine's own region - en-US on a US laptop - and flip the default suite to 12h
// and feet. Tests that want a specific profile call setActiveLocale explicitly;
// deviceLocale.test overrides this per case with its own doMock.
jest.mock('expo-localization', () => ({ getLocales: () => [] }));
