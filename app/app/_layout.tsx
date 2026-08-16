import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { createQueryClient } from '../src/api/queries';
import { t } from '../src/i18n';
import { initGlobalErrorHandler } from '../src/telemetry/globalHandler';
import { reportError } from '../src/telemetry/report';
import { ErrorFallback } from '../src/ui/ErrorFallback';
import { colors } from '../src/ui/theme';

/**
 * React Query has no idea a phone can lose signal - on the web it infers it from
 * browser events that do not exist here. Without this it would keep firing
 * requests into a dead radio instead of pausing them for replay.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // `isInternetReachable` is null while it is still being determined; treating
    // that as offline would wrongly pause mutations during the check.
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  }),
);

const queryClient = createQueryClient();

// Log uncaught errors and rejected promises that never reach a boundary.
initGlobalErrorHandler();

// Hold the native splash up until the first screen has mounted, so launch shows a
// branded screen instead of a blank flash. There are no fonts to wait on, so the
// first render is the ready signal. `catch` because this rejects if the splash is
// already gone (e.g. a fast-refresh remount), which is harmless.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * AsyncStorage rather than MMKV: MMKV needs a custom dev build, and the reviewer
 * should be able to `npx expo start` into Expo Go and have it work. The volume
 * here is a handful of shifts, so MMKV's speed would buy nothing.
 */
const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * Discards the persisted cache whenever the app version changes. Without it, a
 * release that changes the `Shift` shape rehydrates yesterday's records into code
 * that no longer understands them - and `gcTime` is 24h, so it would keep doing so
 * for a full day of cold starts rather than failing once and recovering.
 */
const CACHE_BUSTER = Constants.expoConfig?.version ?? 'dev';

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    // Outermost so a render error anywhere below shows the friendly fallback
    // instead of React Native's red screen, and is logged through the same seam.
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={(error) => reportError(error, 'render')}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, buster: CACHE_BUSTER }}
        // A clock-in made in a basement is restored from disk as a paused mutation.
        // This is what actually sends it once the app is back with signal.
        onSuccess={() => {
          void queryClient.resumePausedMutations();
        }}
      >
        {/* Seeding the insets synchronously avoids a first frame laid out as if the
            notch and nav bar were not there, which reads as a visible jump. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.paper },
              headerTitleStyle: { color: colors.ink },
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            <Stack.Screen name="index" options={{ title: t('screen.title') }} />
          </Stack>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
