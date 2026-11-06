import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useFavorites, useToggleFavorite } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { getMatchup, submitVote, type Matchup } from '../../../lib/api';
import { useAuthStatus } from '../../../lib/auth';
import { ApiError, errorMessage } from '../../../lib/errors';

type Post = Matchup['postA'];

function VoteCard({ post, label, disabled, onVote }: {
  post: Post;
  label: string;
  disabled: boolean;
  onVote: () => void;
}) {
  const theme = useTheme();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === post.id) ?? false;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.imageWrapper}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} borderRadius={0} />
      </View>
      <Pressable
        onPress={onVote}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voteButton,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.text}>{label}</ThemedText>
      </Pressable>
      <Pressable style={styles.star} onPress={() => toggleFavorite.mutate({ post, favorite: !favorited })}>
        <SymbolView
          name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
          tintColor={favorited ? '#FFD84D' : theme.textSecondary}
          size={32}
        />
      </Pressable>
    </ThemedView>
  );
}
function VoteCardBottom({ post, label, disabled, onVote }: {
  post: Post;
  label: string;
  disabled: boolean;
  onVote: () => void;
}) {
  const theme = useTheme();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const favorited = favorites.data?.some((p) => p.id === post.id) ?? false;

  return (
    <ThemedView type="backgroundElement" style={[styles.cardBottom, { borderColor: theme.border }]}>
      <View style={styles.imageWrapperBottom}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} borderRadius={0} />
      </View>
      <Pressable
        onPress={onVote}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voteButtonBottom,
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.text} >{label}</ThemedText>
      </Pressable>
      <Pressable style={styles.starBottom} onPress={() => toggleFavorite.mutate({ post, favorite: !favorited })}>
        <SymbolView
          name={{ ios: favorited ? 'star.fill' : 'star', android: 'star', web: 'star' }}
          tintColor={favorited ? '#FFD84D' : theme.textSecondary}
          size={32}
        />
      </Pressable>
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
    onSuccess: () => queryClient.resetQueries({ queryKey: ['matchup'] }),
    onError: (error) => {
      if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
        toast.error('That matchup expired. Here is a new one.');
        queryClient.resetQueries({ queryKey: ['matchup'] });
        return;
      }
      toast.error(errorMessage(error, 'Could not submit your vote.'));
    },
  });

  const matchup = matchupQuery.data;
  const vote = (winner: Post, loser: Post) => {
    if (!matchup || voteMutation.isPending) return;
    voteMutation.mutate({ matchup, winner, loser });
  };

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
          post={matchup.postA}
          label="Vote"
          disabled={voteMutation.isPending}
          onVote={() => vote(matchup.postA, matchup.postB)}
        />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.vs}>
          VS
        </ThemedText>
        <VoteCardBottom
          post={matchup.postB}
          label="Vote"
          disabled={voteMutation.isPending}
          onVote={() => vote(matchup.postB, matchup.postA)}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        {content}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    paddingBottom: BottomTabInset + Spacing.six,
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
  vs: {
    textAlign: 'center',
    padding: 25,
  },
});
