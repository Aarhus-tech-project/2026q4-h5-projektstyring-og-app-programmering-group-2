import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRanking, RankedPost } from '../../../lib/api';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const medalColors = ['#FFD84D', '#C9CED6', '#E8A15C'];
const shameColors = ['#EF4444', '#DC2626', '#B91C1C'];

const periods = ['Trending', 'This week', 'All time'];

type Trend = 'up' | 'down';

type LeaderboardRowProps = {
  placement: number;
  photo: RankedPost;
  medals: string[];
  trend?: Trend;
};

function LeaderboardRow({ placement, photo, medals, trend }: LeaderboardRowProps) {
  const theme = useTheme();
  const medal = medals[placement - 1];

  return (
    <View style={styles.row}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.imageWrapper} >
          <ExpandableImage thumbnailUrl={photo.thumbnailUrl} imageUrl={photo.imageUrl} borderRadius={10} />

          <View
            style={[
              styles.badge,
              { borderColor: medal ?? 'rgba(255, 255, 255, 0.3)', backgroundColor: medal ?? 'rgba(0, 0, 0, 0.6)' },
            ]}>
            <ThemedText type="smallBold" style={[styles.badgeText, { color: medal ? '#111111' : '#FFFFFF' }]}>
              {placement}
            </ThemedText>
          </View>
        </View>

        <View style={styles.info}>

          <ThemedText type="small" themeColor="textSecondary">
            {trend && (
              <ThemedText type="smallBold" style={{ color: trend === 'up' ? '#4ADE80' : '#F87171' }}>
                {trend === 'up' ? '▲  ' : '▼  '}
              </ThemedText>
            )}
            <ThemedText type="smallBold">{Math.round(Number(photo.elo))} Elo</ThemedText>
            {'  ·  '}
            <ThemedText type="small" style={{ color: '#4ADE80' }}>{photo.wins} wins</ThemedText>
            {'  ·  '}
            <ThemedText type="small" style={{ color: '#F87171' }}>{photo.losses} losses</ThemedText>
          </ThemedText>
        </View>
      </ThemedView>
    </View>
  );
}

function FlipButton({ worst, onPress }: { worst: boolean; onPress: () => void }) {
  const theme = useTheme();
  const icon = (
    <SymbolView
      name={{ ios: worst ? 'arrow.down' : 'arrow.up', android: worst ? 'arrow_downward' : 'arrow_upward', web: worst ? 'arrow_downward' : 'arrow_upward' }}
      tintColor={worst ? '#F87171' : theme.text}
      size={18}
    />
  );

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {useGlass ? (
        <GlassView
          style={styles.flip}
          glassEffectStyle="regular"
          isInteractive
          tintColor={worst ? 'rgba(239,68,68,0.25)' : undefined}>
          {icon}
        </GlassView>
      ) : (
        <View
          style={[
            styles.flip,
            {
              backgroundColor: worst ? 'rgba(239,68,68,0.15)' : theme.backgroundElement,
              borderColor: worst ? 'rgba(239,68,68,0.5)' : theme.border,
              borderWidth: 1,
            },
          ]}>
          {icon}
        </View>
      )}
    </Pressable>
  );
}

function trendingMix(top: RankedPost[], worst: RankedPost[]): { post: RankedPost; trend: Trend }[] {
  const rising = top.slice(0, 5).map((post) => ({ post, trend: 'up' as const }));
  const falling = worst.slice(0, 5).map((post) => ({ post, trend: 'down' as const }));
  return rising.flatMap((r, i) => (falling[i] ? [r, falling[i]] : [r])).concat(falling.slice(rising.length));
}

export default function RankingScreen() {
  const [period, setPeriod] = useState(0);
  const [worstMode, setWorstMode] = useState(false);
  const [top, setTop] = useState<RankedPost[]>([]);
  const [worst, setWorst] = useState<RankedPost[]>([]);
  
  useFocusEffect(useCallback(() => {
    Promise.all([getRanking('top'), getRanking('worst')])
      .then(([topPosts, worstPosts]) => {
        setTop(topPosts);
        setWorst(worstPosts);
      })
      .catch((error) => console.error('Failed to load ranking', error));
  }, []));

  const trending = period === 0;
  const showWorst = !trending && worstMode;
  const rows: { post: RankedPost; trend?: Trend }[] = trending
    ? trendingMix(top, worst)
    : (showWorst ? worst : top).map((post) => ({ post }));

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <SegmentedControl
            values={periods}
            selectedIndex={period}
            onChange={(event) => setPeriod(event.nativeEvent.selectedSegmentIndex)}
            appearance="dark"
            style={styles.segmented}
          />
          {!trending && <FlipButton worst={worstMode} onPress={() => setWorstMode(!worstMode)} />}
        </View>
        <FlatList
          data={rows}
          keyExtractor={(row) => `${row.trend ?? ''}${row.post.id}`}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              placement={index + 1}
              photo={item.post}
              medals={showWorst ? shameColors : medalColors}
              trend={item.trend}
            />
          )}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.three,
  },
  segmented: {
    flex: 1,
  },
  flip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  badgeText: {
    transform: [{ rotate: '-45deg' }],
  },
  card: {
    flex: 1,
    height: 250,
    flexDirection: 'column',
    alignItems: 'center',
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
  },
  imageWrapper: {
    width: '100%',
    height: 200,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  info: {
    flex: 1,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
});
