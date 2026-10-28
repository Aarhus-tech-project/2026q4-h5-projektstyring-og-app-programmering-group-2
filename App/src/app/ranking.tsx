import { ExpandableImage } from '@/components/ui/expandable-image';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRanking, RankedPost } from '../../lib/api';
import { SegmentedControl } from '@expo/ui/community/segmented-control'



const medalColors = ['#FFD84D', '#C9CED6', '#E8A15C'];

type LeaderboardRowProps = {
  placement: number;
  photo: RankedPost;
};

function LeaderboardRow({ placement, photo }: LeaderboardRowProps) {
  const theme = useTheme();
  const medal = medalColors[placement - 1];

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
            <ThemedText type="smallBold">{photo.elo} Elo</ThemedText>
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

export default function RankingScreen() {
  const [tab, setTab] = useState(0);
  const [top, setTop] = useState<RankedPost[]>([]);
  const [worst, setWorst] = useState<RankedPost[]>([]);
  
  useEffect(() => {
    Promise.all([getRanking('top'), getRanking('worst')])
      .then(([topPosts, worstPosts]) => {
        setTop(topPosts);
        setWorst(worstPosts);
      })
      .catch((error) => console.error('Failed to load ranking', error));
  }, []);

  const posts = tab === 0 ? top : worst;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <SegmentedControl
          values={['Top Rated', 'Worst Rated']}
          selectedIndex={tab}
          onChange={(event) => setTab(event.nativeEvent.selectedSegmentIndex)}
          appearance="dark"
          style={styles.segmented}
        />
        <FlatList
          data={posts}
          keyExtractor={(photo) => photo.id}
          renderItem={({ item, index }) => <LeaderboardRow placement={index + 1} photo={item} />}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  segmented: {
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.three,
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
