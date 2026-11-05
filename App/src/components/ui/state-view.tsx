import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { errorMessage, isNetworkError } from '../../../lib/errors';

type StateViewProps = {
  icon: SymbolViewProps['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StateView({ icon, title, message, actionLabel, onAction, busy, style }: StateViewProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <SymbolView name={icon} tintColor={theme.textSecondary} size={40} />
      <ThemedText type="smallBold" style={styles.center}>{title}</ThemedText>
      {message && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{message}</ThemedText>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            (pressed || busy) && styles.dimmed,
          ]}>
          {busy ? <ActivityIndicator color={theme.text} /> : <ThemedText type="smallBold">{actionLabel}</ThemedText>}
        </Pressable>
      )}
    </View>
  );
}

export function ErrorState({ error, onRetry, retrying, style }: {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const offline = isNetworkError(error);
  return (
    <StateView
      icon={offline
        ? { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }
        : { ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
      title={offline ? "You're offline" : "Couldn't load this"}
      message={errorMessage(error)}
      actionLabel="Try again"
      onAction={onRetry}
      busy={retrying}
      style={style}
    />
  );
}

export function OfflineState({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <StateView
      icon={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }}
      title="You're offline"
      message="This loads automatically as soon as you're back online."
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.two,
    minWidth: 120,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    borderWidth: 1,
  },
  dimmed: {
    opacity: 0.6,
  },
});
