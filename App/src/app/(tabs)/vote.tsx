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
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-screens/experimental';
import { toast } from 'sonner-native';
import { getMatchup, submitVote, type Matchup } from '../../../lib/api';
import { useAuthStatus } from '../../../lib/auth';
import { ApiError, errorMessage } from '../../../lib/errors';

type Post = Matchup['postA'];

const AUTO_ADVANCE_MS = 2500;

function eloRank(post: Post, other: Post): EloRank {
  const elo = Math.round(post.elo);
  const otherElo = Math.round(other.elo);
  return elo === otherElo ? 'equal' : elo > otherElo ? 'higher' : 'lower';
}

function VoteCard({ post, label, disabled, onVote, reveal }: {
  post: Post;
  label: string;
  disabled: boolean;
  onVote: () => void;
  reveal: { rank: EloRank; picked: boolean } | null;
}) {
  const theme = useTheme();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === post.id) ?? false;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.imageWrapper}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} thumbhash={post.thumbhash} borderRadius={0} />
        {reveal && (
          <EloReveal elo={post.elo} wins={post.wins} losses={post.losses} rank={reveal.rank} />
        )}
      </View>
      {!reveal && <Pressable
        onPress={onVote}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voteButton,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.text}>{label}</ThemedText>
      </Pressable>}
      <Pressable style={styles.star} onPress={() => toggleFavorite.mutate({ post, favorite: !favorited })}>
        <SymbolView
          name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
          tintColor={favorited ? '#FFD84D' : theme.textSecondary}
          size={32}
        />
      </Pressable>
      {reveal?.picked && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.pickedRing} />
      )}
    </ThemedView>
  );
}
function VoteCardBottom({ post, label, disabled, onVote, reveal }: {
  post: Post;
  label: string;
  disabled: boolean;
  onVote: () => void;
  reveal: { rank: EloRank; picked: boolean } | null;
}) {
  const theme = useTheme();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === post.id) ?? false;

  return (
    <ThemedView type="backgroundElement" style={[styles.cardBottom, { borderColor: theme.border }]}>
      <View style={styles.imageWrapperBottom}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} thumbhash={post.thumbhash} borderRadius={0} />
        {reveal && (
          <EloReveal elo={post.elo} wins={post.wins} losses={post.losses} rank={reveal.rank} />
        )}
      </View>
      {!reveal && <Pressable
        onPress={onVote}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voteButtonBottom,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.text} >{label}</ThemedText>
      </Pressable>}
      <Pressable style={styles.starBottom} onPress={() => toggleFavorite.mutate({ post, favorite: !favorited })}>
        <SymbolView
          name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
          tintColor={favorited ? '#FFD84D' : theme.textSecondary}
          size={32}
        />
      </Pressable>
      {reveal?.picked && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.pickedRing} />
      )}
    </ThemedView>
  );
}


function VoteSkeleton() {
  const theme = useTheme();
  return (
    <View style={styles.cards}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <Skeleton style={[styles.imageWrapper, { borderRadius: 0 }]} />
      </ThemedView>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.vs}>
        VS
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.cardBottom, { borderColor: theme.border }]}>
        <Skeleton style={[styles.imageWrapperBottom, { borderRadius: 0 }]} />
      </ThemedView>
    </View>
  );
}

export default function VoteScreen() {
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
    content = <VoteSkeleton />;
  } else {
    content = (
      <View style={styles.cards}>
        <VoteCard
          key={`${matchup.id}-a`}
          post={matchup.postA}
          label="Vote"
          disabled={!!reveal || voteMutation.isPending}
          onVote={() => vote(matchup.postA, matchup.postB)}
          reveal={reveal && { rank: eloRank(matchup.postA, matchup.postB), picked: reveal.pickedId === matchup.postA.id }}
        />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.vs}>
          VS
        </ThemedText>
        <VoteCardBottom
          key={`${matchup.id}-b`}
          post={matchup.postB}
          label="Vote"
          disabled={!!reveal || voteMutation.isPending}
          onVote={() => vote(matchup.postB, matchup.postA)}
          reveal={reveal && { rank: eloRank(matchup.postB, matchup.postA), picked: reveal.pickedId === matchup.postB.id }}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={{ top: true, bottom: true }}>
        <Wordmark size={20} style={styles.brand} />
        {content}
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
  text: {
    color: 'black',
  },
  title: {
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  cards: {
    flex: 1,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  card: {
    flex: 1,
    padding: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    paddingBottom: 60,
    borderRadius: 40,
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36
  },
  voteButton: {
  position: 'absolute',
  bottom: -30,
  left: 20,
  paddingVertical: Spacing.four,
  paddingHorizontal: Spacing.six,
  backgroundColor: '#B2F2BB',
  borderWidth: 2,
  borderColor: '#000',
  borderRadius: 16,
},
cardBottom: {
  flex: 1,
  padding: Spacing.two,
  paddingTop: 60,
  gap: Spacing.two,
  borderWidth: 1,
  borderRadius: 40,
},
imageWrapperBottom: {
  flex: 1,
  width: '100%',
  overflow: 'hidden',
  borderBottomLeftRadius: 36,
  borderBottomRightRadius: 36,
},
voteButtonBottom: {
  position: 'absolute',
  top: -30,
  right: 20,
  paddingVertical: Spacing.four,
  paddingHorizontal: Spacing.six,
  backgroundColor: '#B2F2BB',
  borderWidth: 2,
  borderColor: '#000',
  borderRadius: 16,
},
star: {
  position: 'absolute',
  bottom: 14,
  right: 40,
},
starBottom: {
  position: 'absolute',
  top: 14,
  left: 35,
},

  disabled: {
    opacity: 0.5,
  },
  pickedRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 3,
    borderRadius: 40,
    borderColor: '#B2F2BB',
    pointerEvents: 'none',
  },
  vs: {
    textAlign: 'center',
    padding: 25,
  },
});
