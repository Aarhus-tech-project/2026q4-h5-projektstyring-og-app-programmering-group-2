import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMatchup, submitVote, type Matchup } from '../../lib/api';

type Post = Matchup['postA'];

function VoteCard({ post, label, disabled, onVote }: {
  post: Post;
  label: string;
  disabled: boolean;
  onVote: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.imageWrapper}>
        <ExpandableImage thumbnailUrl={post.thumbnailUrl} imageUrl={post.imageUrl} borderRadius={10} />
      </View>
      <Pressable
        onPress={onVote}
        disabled={disabled}
        style={({ pressed }) => [
          styles.voteButton,
          { backgroundColor: pressed ? theme.backgroundSelected : theme.background, borderColor: theme.border },
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function VoteScreen() {
  const theme = useTheme();
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  const fetchMatchup = () =>
    getMatchup()
      .then((m) => {
        console.log('matchup', m);
        setMatchup(m);
      })
      .catch((e) => {
        console.error('Failed to load matchup', e);
        setError('Could not load a matchup. Are you logged in?');
      });

  const load = async () => {
    setError(null);
    setMatchup(null);
    await fetchMatchup();
  };

  useEffect(() => {
    fetchMatchup();
  }, []);

  const vote = async (winner: Post, loser: Post) => {
    if (!matchup) return;
    setVoting(true);
    try {
      await submitVote(matchup.id, winner.id, loser.id);
      await load();
    } catch (e) {
      console.error('Failed to vote', e);
      setError('Could not submit your vote.');
    } finally {
      setVoting(false);
    }
  };

  let content;
  if (error) {
    content = (
      <View style={styles.center}>
        <ThemedText themeColor="textSecondary">{error}</ThemedText>
        <Pressable onPress={load} style={[styles.voteButton, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Try again</ThemedText>
        </Pressable>
      </View>
    );
  } else if (!matchup) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  } else {
    content = (
      <View style={styles.cards}>
        <VoteCard
          post={matchup.postA}
          label="Vote for this one"
          disabled={voting}
          onVote={() => vote(matchup.postA, matchup.postB)}
        />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.vs}>
          VS
        </ThemedText>
        <VoteCard
          post={matchup.postB}
          label="Vote for this one"
          disabled={voting}
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  card: {
    flex: 1,
    padding: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
  },
  imageWrapper: {
    flex: 1,
    width: '100%',
  },
  voteButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderRadius: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  vs: {
    textAlign: 'center',
    marginVertical: Spacing.two,
  },
});
