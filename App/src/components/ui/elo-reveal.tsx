import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export type EloRank = 'higher' | 'lower' | 'equal';

export function EloReveal({ elo, wins, losses, rank }: {
  elo: number;
  wins: number;
  losses: number;
  rank: EloRank;
}) {
  const shownElo = useCountUp(Math.round(elo), 800);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.scrim}>
      <View style={styles.content}>
        <View style={styles.eloRow}>
          <View style={styles.rankSlot}>
            {rank !== 'equal' && (
              <Animated.Text entering={FadeIn.delay(800).duration(300)} style={styles.rank}>
                {rank === 'higher' ? '▲' : '▼'}
              </Animated.Text>
            )}
          </View>
          <Text style={styles.elo}>{shownElo}</Text>
          <View style={styles.rankSlot} />
        </View>
        <Text style={styles.eloLabel}>ELO</Text>
        <Animated.View entering={FadeIn.delay(400).duration(300)}>
          <Text style={styles.record}>
            <Text style={styles.wins}>{wins} W</Text>
            {'  ·  '}
            <Text style={styles.losses}>{losses} L</Text>
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function NextButton({ onPress, durationMs }: { onPress: () => void; durationMs: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: durationMs, easing: Easing.linear });
  }, [progress, durationMs]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const label = (
    <>
      <ThemedText type="smallBold">Next</ThemedText>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        tintColor={theme.text}
        size={14}
      />
      <Animated.View style={[styles.bar, barStyle]} />
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <Pressable onPress={onPress} hitSlop={8}>
        {useGlass ? (
          <GlassView style={styles.next} glassEffectStyle="regular" isInteractive>
            {label}
          </GlassView>
        ) : (
          <View style={[styles.next, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }]}>
            {label}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  content: {
    alignItems: 'center',
    gap: 2,
  },
  eloRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankSlot: {
    width: 36,
    alignItems: 'center',
  },
  rank: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 22,
    fontWeight: '700',
  },
  elo: {
    color: '#FFD84D',
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  eloLabel: {
    color: '#FFD84D',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  record: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  wins: {
    color: '#4ADE80',
    fontWeight: '700',
  },
  losses: {
    color: '#F87171',
    fontWeight: '700',
  },
  next: {
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    backgroundColor: '#B2F2BB',
  },
});
