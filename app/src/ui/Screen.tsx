import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

/** Page shell: safe area plus the paper background, so screens never restate it. */
export function Screen({ style, children, ...rest }: ViewProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.content, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
  },
});
