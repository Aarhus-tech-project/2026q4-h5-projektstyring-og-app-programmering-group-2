import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { PeriodPicker } from '@/components/ui/period-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useFavorites, useToggleFavorite } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRanking, RankedPost, RankingPeriod } from '../../../lib/api';
import { useAuthStatus } from '../../../lib/auth';


const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const medalColors = ['#FFD84D', '#C9CED6', '#E8A15C'];
const shameColors = ['#EF4444', '#DC2626', '#B91C1C'];
const trendColors = { up: '#4ADE80', down: '#F87171' } as const;

const periods: { label: string; key: RankingPeriod }[] = [
  { label: 'Trending', key: 'trending' },
  { label: 'This week', key: 'week' },
  { label: 'All time', key: 'all' },
];

type Trend = 'up' | 'down';

type LeaderboardRowProps = {
  placement: number;
  photo: RankedPost;
  medals: string[];
  trend?: Trend;
  showPlacement: boolean;
};

function LeaderboardRow({ placement, photo, medals, trend, showPlacement }: LeaderboardRowProps) {
  const theme = useTheme();
  const medal = medals[placement - 1];
  const signedIn = useAuthStatus() === 'signedIn';
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === photo.id) ?? false;

  return (
    <View style={styles.row}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.imageWrapper} >
          <ExpandableImage thumbnailUrl={photo.thumbnailUrl} imageUrl={photo.imageUrl} thumbhash={photo.thumbhash} borderRadius={10} user={photo.profile} stats={photo} />

          {showPlacement && (
            <View
              style={[
                styles.badge,
                { borderColor: medal ?? 'rgba(255, 255, 255, 0.3)', backgroundColor: medal ?? 'rgba(0, 0, 0, 0.6)' },
              ]}>
              <ThemedText type="smallBold" style={[styles.badgeText, { color: medal ? '#111111' : '#FFFFFF' }]}>
                {placement}
              </ThemedText>
            </View>
          )}

          {trend && (
            <View
              style={[
                styles.badge,
                { borderColor: trendColors[trend], backgroundColor: trendColors[trend] },
              ]}>
              <SymbolView
                name={{
                  ios: trend === 'up' ? 'arrow.up' : 'arrow.down',
                  android: trend === 'up' ? 'arrow_upward' : 'arrow_downward',
                  web: trend === 'up' ? 'arrow_upward' : 'arrow_downward',
                }}
                tintColor="#111111"
                size={15}
                weight="bold"
                style={styles.badgeText}
              />
            </View>
          )}

          <View style={styles.avatar}>
            <Pressable onPress={() => openProfile(photo.profile.userId)}>
              <Avatar
                thumbnailUrl={photo.avatarThumbnailUrl}
                imageUrl={photo.avatarUrl}
                thumbhash={photo.avatarThumbhash}
                size={40}
                expandable={false}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.info}>

          <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold">{Math.round(photo.elo)} Elo</ThemedText>
            {'  ·  '}
            <ThemedText type="small" style={{ color: '#4ADE80' }}>{photo.wins} W</ThemedText>
            {'  ·  '}
            <ThemedText type="small" style={{ color: '#F87171' }}>{photo.losses} L</ThemedText>
          </ThemedText>

          {signedIn && (
            <Pressable
              style={styles.star}
              hitSlop={8}
              onPress={() => toggleFavorite.mutate({ post: photo, favorite: !favorited })}
              accessibilityRole="button"
              accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}>
              <SymbolView
                name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
                tintColor={favorited ? '#FFD84D' : theme.textSecondary}
                size={20}
              />
            </Pressable>
          )}
        </View>
      </ThemedView>
    </View>
  );
}

function FlipButton({ worst, size, onPress }: { worst: boolean; size: number; onPress: () => void }) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
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
          style={[styles.flip, shape]}
          glassEffectStyle="regular"
          isInteractive
          tintColor={worst ? 'rgba(239,68,68,0.25)' : undefined}>
          {icon}
        </GlassView>
      ) : (
        <View
          style={[
            styles.flip,
            shape,
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


function openProfile(userId: string) {
  router.push({ pathname: '/othersProfile', params: { userId } });
}

function SkeletonRow() {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <Skeleton style={[styles.imageWrapper, { borderRadius: 10 }]} />
        <View style={styles.info}>
          <Skeleton style={styles.skeletonLine} />
        </View>
      </ThemedView>
    </View>
  );
}

function trendingMix(top: RankedPost[], worst: RankedPost[]): { post: RankedPost; trend: Trend }[] {
  const rising = top.slice(0, 5).map((post) => ({ post, trend: 'up' as const }));
  const falling = worst.slice(0, 5).map((post) => ({ post, trend: 'down' as const }));
  return rising.flatMap((r, i) => (falling[i] ? [r, falling[i]] : [r])).concat(falling.slice(rising.length));
}

export default function RankingScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState(0);
  const [worstMode, setWorstMode] = useState(false);
  const [barHeight, setBarHeight] = useState(36);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + Spacing.three * 2 + barHeight;

  const trending = period === 0;
  const showWorst = !trending && worstMode;
  const periodKey = periods[period].key;
  const topQuery = useQuery({ queryKey: ['ranking', periodKey, 'top'], queryFn: () => getRanking(periodKey, 'top') });
  const worstQuery = useQuery({ queryKey: ['ranking', periodKey, 'worst'], queryFn: () => getRanking(periodKey, 'worst') });
  const active = trending ? [topQuery, worstQuery] : [showWorst ? worstQuery : topQuery];
  const loading = active.some((query) => query.isPending);
  const offline = active.some((query) => query.isPending && query.fetchStatus === 'paused');
  const failed = active.find((query) => query.isError && !query.data);
  const retrying = active.some((query) => query.isFetching);

  const top = topQuery.data ?? [];
  const worst = worstQuery.data ?? [];
  const rows: { post: RankedPost; trend?: Trend }[] = loading || failed
    ? []
    : trending
      ? trendingMix(top, worst)
      : (showWorst ? worst : top).map((post) => ({ post }));

  const refetchActive = () => Promise.all(active.map((query) => query.refetch()));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchActive();
    } finally {
      setRefreshing(false);
    }
  };

  const queryClient = useQueryClient();
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ranking'] }, { cancelRefetch: false });
  }, [queryClient]));

  const flipProgress = useSharedValue(trending ? 0 : 1);
  const flipVisible = useSharedValue(trending ? 0 : 1);
  const flipSize = useSharedValue(barHeight);

  useEffect(() => {
    flipSize.set(barHeight);
  }, [barHeight, flipSize]);

  useEffect(() => {
    const timing = { duration: 220, easing: Easing.out(Easing.cubic) };
    if (trending) {
      flipVisible.set(0);
      flipProgress.set(withTiming(0, timing));
    } else {
      flipProgress.set(withTiming(1, timing, (finished) => {
        if (finished) flipVisible.set(1);
      }));
    }
  }, [trending, flipProgress, flipVisible]);

  const flipStyle = useAnimatedStyle(() => ({
    width: flipProgress.get() * (flipSize.get() + Spacing.two),
    opacity: flipVisible.get(),
  }));

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => `${row.trend ?? ''}${row.post.id}`}
        renderItem={({ item, index }) => (
          <LeaderboardRow
            placement={index + 1}
            photo={item.post}
            medals={showWorst ? shameColors : medalColors}
            trend={item.trend}
            showPlacement={!trending}
          />
        )}
        ListEmptyComponent={
          offline ? (
            <OfflineState />
          ) : loading ? (
            <View style={styles.skeletons}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : failed ? (
            <ErrorState error={failed.error} onRetry={refetchActive} retrying={retrying} />
          ) : (
            <StateView
              icon={{ ios: 'trophy', android: 'leaderboard', web: 'leaderboard' }}
              title="No photos ranked yet"
              message="Once people start voting, the best and worst photos show up here."
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textSecondary}
            progressViewOffset={headerHeight}
          />
        }
        contentContainerStyle={[styles.list, { paddingTop: headerHeight }]}
        scrollIndicatorInsets={{ top: headerHeight - insets.top }}
      />
      <View style={[styles.topBar, { top: insets.top + Spacing.three }]}>
        <View
          style={styles.segmented}
          onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}>
          <PeriodPicker values={periods.map((p) => p.label)}selectedIndex={period} onChange={setPeriod} />
        </View>
        <Animated.View
          style={[styles.flipSlot, { height: barHeight }, flipStyle, { pointerEvents: trending ? 'none' : 'auto' }]}
          aria-hidden={trending}>
          <FlipButton worst={worstMode} size={barHeight} onPress={() => setWorstMode(!worstMode)} />
        </Animated.View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmented: {
    flex: 1,
  },
  flipSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  flip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletons: {
    gap: Spacing.three,
  },
  skeletonLine: {
    width: '60%',
    height: 14,
  },
  list: {
    flexGrow: 1,
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
  avatar: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  card: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  info: {
    width: '100%',
    gap: 2,
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  star: {
    position: 'absolute',
    right: Spacing.one,
    top: Spacing.two,
  },
});
