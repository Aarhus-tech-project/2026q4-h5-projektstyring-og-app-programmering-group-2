import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Wordmark } from '@/components/ui/brand';
import { EloReveal, type EloRank } from '@/components/ui/elo-reveal';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { Spacing } from '@/constants/theme';
import { useFavorites, useToggleFavorite } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-screens/experimental';
import { toast } from 'sonner-native';
import { getMatchup, submitVote, type Matchup } from '../../../lib/api';
import { useAuthStatus } from '../../../lib/auth';
import { ApiError, errorMessage } from '../../../lib/errors';

type Post = Matchup['postA'];

const AUTO_ADVANCE_MS = 2500;
const GAP = Spacing.three;
const GUTTER = Spacing.three;
const RADIUS = 28;
const VOTE_GREEN = '#B2F2BB';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const cardEnter = (delay: number) => FadeInRight.springify().damping(28).stiffness(240).delay(delay);
const cardExit = FadeOutLeft.duration(220);

function eloRank(post: Post, other: Post): EloRank {
  const elo = Math.round(post.elo);
  const otherElo = Math.round(other.elo);
  return elo === otherElo ? 'equal' : elo > otherElo ? 'higher' : 'lower';
}

function GlassCircle({ children }: { children: React.ReactNode }) {
  return useGlass ? (
    <GlassView style={styles.circle} glassEffectStyle="regular" isInteractive>
      {children}
    </GlassView>
  ) : (
    <BlurView style={styles.circle} intensity={40} tint="dark">
      {children}
    </BlurView>
  );
}

function VoteCard({ post, size, delay, votePosition, disabled, onVote, reveal }: {
  post: Post;
  size: number;
  delay: number;
  votePosition: 'top' | 'bottom';
  disabled: boolean;
  onVote: () => void;
  reveal: { rank: EloRank; picked: boolean } | null;
}) {
  const theme = useTheme();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === post.id) ?? false;

  return (
    <Animated.View entering={cardEnter(delay)} exiting={cardExit} style={{ width: size, height: size }}>
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} thumbhash={post.thumbhash} borderRadius={0} />
        {reveal && <EloReveal elo={post.elo} wins={post.wins} losses={post.losses} rank={reveal.rank} />}
        <Pressable
          style={[styles.star, votePosition === 'top' ? styles.starTop : styles.starBottom]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
          onPress={() => toggleFavorite.mutate({ post, favorite: !favorited })}>
          <GlassCircle>
            <SymbolView
              name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
              tintColor={favorited ? '#FFD84D' : '#FFFFFF'}
              size={20}
            />
          </GlassCircle>
        </Pressable>
        {!reveal && (
          <View pointerEvents="box-none" style={[styles.voteRow, votePosition === 'top' ? styles.voteRowTop : styles.voteRowBottom]}>
            <Pressable
              onPress={onVote}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Vote for this photo"
              style={({ pressed }) => [
                styles.voteButton,
                (pressed || disabled) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.voteText}>Vote</ThemedText>
            </Pressable>
          </View>
        )}
      </View>
      {reveal?.picked && <Animated.View entering={FadeIn.duration(250)} style={styles.pickedRing} />}
    </Animated.View>
  );
}

function VsBadge() {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={styles.vsLayer}>
      <View style={[styles.vsBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">VS</ThemedText>
      </View>
    </View>
  );
}

export default function VoteScreen() {
  const theme = useTheme();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const size = Math.floor(Math.max(0, Math.min(area.width - GUTTER * 2, (area.height - GAP) / 2)));
  const queryClient = useQueryClient();
  const auth = useAuthStatus();
  const [reveal, setReveal] = useState<{ matchup: Matchup; pickedId: string } | null>(null);
  const progress = useRef({ matchupId: '', ready: false, voted: false });
  const autoAdvance = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const matchupQuery = useQuery({
    queryKey: ['matchup'],
    queryFn: getMatchup,
    enabled: auth === 'signedIn',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const voteMutation = useMutation({
    mutationFn: ({ matchup, winner, loser }: { matchup: Matchup; winner: Post; loser: Post }) =>
      submitVote(matchup.id, winner.id, loser.id),
    onSuccess: async () => {
      await queryClient.prefetchQuery({ queryKey: ['matchup'], queryFn: getMatchup, staleTime: 0 });
      progress.current.voted = true;
      finishReveal();
    },
    onError: (error) => {
      clearTimeout(autoAdvance.current);
      progress.current.matchupId = '';
      setReveal(null);
      if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
        toast.error('That matchup expired. Here is a new one.');
        queryClient.resetQueries({ queryKey: ['matchup'] });
        return;
      }
      toast.error(errorMessage(error, 'Could not submit your vote.'));
    },
  });

  const matchup = reveal?.matchup ?? matchupQuery.data;
  const nextMatchup = reveal && matchupQuery.data?.id !== reveal.matchup.id ? matchupQuery.data : undefined;

  function finishReveal() {
    const { matchupId, ready, voted } = progress.current;
    if (!matchupId || !ready || !voted) return;
    progress.current.matchupId = '';
    clearTimeout(autoAdvance.current);
    setReveal(null);
    if (queryClient.getQueryData<Matchup>(['matchup'])?.id === matchupId) {
      queryClient.resetQueries({ queryKey: ['matchup'] });
    }
  }

  function skipWait() {
    progress.current.ready = true;
    finishReveal();
  }

  const vote = (winner: Post, loser: Post) => {
    if (!matchup || reveal || voteMutation.isPending) return;
    progress.current = { matchupId: matchup.id, ready: false, voted: false };
    setReveal({ matchup, pickedId: winner.id });
    clearTimeout(autoAdvance.current);
    autoAdvance.current = setTimeout(skipWait, AUTO_ADVANCE_MS);
    voteMutation.mutate({ matchup, winner, loser });
  };

  useEffect(() => {
    if (!nextMatchup) return;
    Image.prefetch([nextMatchup.postA.thumbnailUrl, nextMatchup.postB.thumbnailUrl], 'memory-disk');
  }, [nextMatchup]);

  useEffect(() => () => clearTimeout(autoAdvance.current), []);

  let content;
  if (matchupQuery.isError && !matchup) {
    const noMatchup = matchupQuery.error instanceof ApiError && matchupQuery.error.status === 404;
    content = noMatchup ? (
      <StateView
        icon={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
        title="Nothing to vote on yet"
        message="There aren't enough photos for a matchup. Upload one or check back later."
        actionLabel="Check again"
        onAction={() => matchupQuery.refetch()}
        busy={matchupQuery.isFetching}
      />
    ) : (
      <ErrorState error={matchupQuery.error} onRetry={() => matchupQuery.refetch()} retrying={matchupQuery.isFetching} />
    );
  } else if (!matchup && matchupQuery.fetchStatus === 'paused') {
    content = <OfflineState />;
  } else if (!matchup) {
    content = size > 0 && (
      <>
        <View style={{ width: size, height: size }}>
          <Skeleton style={[styles.card, { borderColor: theme.border }]} />
        </View>
        <View style={{ width: size, height: size }}>
          <Skeleton style={[styles.card, { borderColor: theme.border }]} />
        </View>
        <VsBadge />
      </>
    );
  } else {
    content = size > 0 && (
      <>
        <VoteCard
          key={`${matchup.id}-a`}
          post={matchup.postA}
          size={size}
          delay={0}
          votePosition="bottom"
          disabled={!!reveal || voteMutation.isPending}
          onVote={() => vote(matchup.postA, matchup.postB)}
          reveal={reveal && { rank: eloRank(matchup.postA, matchup.postB), picked: reveal.pickedId === matchup.postA.id }}
        />
        <VoteCard
          key={`${matchup.id}-b`}
          post={matchup.postB}
          size={size}
          delay={70}
          votePosition="top"
          disabled={!!reveal || voteMutation.isPending}
          onVote={() => vote(matchup.postB, matchup.postA)}
          reveal={reveal && { rank: eloRank(matchup.postB, matchup.postA), picked: reveal.pickedId === matchup.postB.id }}
        />
        <VsBadge />
      </>
    );
  }

  const showsCards = !(matchupQuery.isError && !matchup) && !(!matchup && matchupQuery.fetchStatus === 'paused');

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={{ top: true, bottom: true }}>
        <Wordmark size={20} style={styles.brand} />
        {showsCards ? (
          <View
            style={styles.cards}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setArea({ width, height: height - Spacing.three * 2 });
            }}>
            {content}
          </View>
        ) : (
          content
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  brand: {
    alignSelf: 'center',
    paddingTop: Spacing.two,
  },
  cards: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
    paddingVertical: Spacing.three,
  },
  card: {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    right: 12,
  },
  starTop: {
    top: 16,
  },
  starBottom: {
    bottom: 16,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  voteRowTop: {
    top: 14,
  },
  voteRowBottom: {
    bottom: 14,
  },
  voteButton: {
    paddingVertical: 12,
    paddingHorizontal: 44,
    borderRadius: 999,
    backgroundColor: VOTE_GREEN,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  voteText: {
    color: '#000000',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  pickedRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 3,
    borderRadius: RADIUS + 3,
    borderColor: VOTE_GREEN,
    pointerEvents: 'none',
  },
  vsLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
