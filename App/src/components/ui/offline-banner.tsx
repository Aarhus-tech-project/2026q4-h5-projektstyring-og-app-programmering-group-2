import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '../../../lib/connectivity';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const connectivity = useConnectivity();

  if (connectivity === 'online') return null;
  const serverDown = connectivity === 'serverDown';

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      accessibilityRole="alert"
      style={[styles.banner, { top: insets.top + Spacing.one }]}>
      <SymbolView
        name={serverDown
          ? { ios: 'icloud.slash', android: 'cloud_off', web: 'cloud_off' }
          : { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }}
        tintColor="#111111"
        size={14}
      />
      <ThemedText type="smallBold" style={styles.text}>
        {serverDown ? "Can't reach the server" : 'No internet connection'}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#FBBF24',
    pointerEvents: 'none',
  },
  text: {
    color: '#111111',
  },
});
