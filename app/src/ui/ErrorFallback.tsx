import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { FallbackProps } from 'react-error-boundary';

import { t } from '../i18n';
import { submitReport } from '../telemetry/report';
import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';
import { spacing } from './theme';

/**
 * The last line of defence. When a render throws, the user sees this - a plain
 * apology and a way forward - instead of React Native's red technical screen. The
 * error itself was already logged via the boundary's onError; from here the user
 * can retry or send a report to the team.
 */
export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function handleReport() {
    setStatus('sending');
    const result = await submitReport();
    setStatus(result.ok ? 'sent' : 'failed');
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.box}>
        <Text variant="title" style={styles.centered}>
          {t('fatal.title')}
        </Text>
        <Text variant="body" tone="muted" style={styles.centered}>
          {t('fatal.detail')}
        </Text>

        <Button label={t('error.tryAgain')} onPress={resetErrorBoundary} />

        {status === 'sent' ? (
          <Text variant="caption" tone="muted" style={styles.centered} accessibilityRole="alert">
            {t('fatal.reportSent')}
          </Text>
        ) : (
          <Button
            label={t('fatal.reportCta')}
            onPress={handleReport}
            loading={status === 'sending'}
            variant="secondary"
          />
        )}

        {status === 'failed' && (
          <Text variant="caption" tone="danger" style={styles.centered} accessibilityRole="alert">
            {t('fatal.reportFailed')}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  box: {
    gap: spacing.md,
    maxWidth: 340,
    width: '100%',
  },
  centered: {
    textAlign: 'center',
  },
});
