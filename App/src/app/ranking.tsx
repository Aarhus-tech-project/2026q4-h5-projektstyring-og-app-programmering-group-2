import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { controlSize, foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Photo = {
  id: string;
  img: string;
  elo: number;
  wins: number;
  loses: number;
};

// Dummy data until the real data comes from the database
const photos: Photo[] = [
  { id: '1', img: 'https://picsum.photos/seed/a/300/180', elo: 1684, wins: 42, loses: 8 },
  { id: '2', img: 'https://picsum.photos/seed/b/300/180', elo: 1612, wins: 37, loses: 11 },
  { id: '3', img: 'https://picsum.photos/seed/c/300/180', elo: 1575, wins: 33, loses: 12 },
  { id: '4', img: 'https://picsum.photos/seed/d/300/180', elo: 1530, wins: 29, loses: 15 },
  { id: '5', img: 'https://picsum.photos/seed/e/300/180', elo: 1498, wins: 25, loses: 18 },
  { id: '6', img: 'https://picsum.photos/seed/f/300/180', elo: 1461, wins: 22, loses: 20 },
  { id: '7', img: 'https://picsum.photos/seed/g/300/180', elo: 1423, wins: 19, loses: 23 },
  { id: '8', img: 'https://picsum.photos/seed/h/300/180', elo: 1387, wins: 16, loses: 25 },
  { id: '9', img: 'https://picsum.photos/seed/i/300/180', elo: 1342, wins: 12, loses: 28 },
  { id: '10', img: 'https://picsum.photos/seed/j/300/180', elo: 1296, wins: 9, loses: 33 },
];


const medalColors = ['#FFD84D', '#C9CED6', '#E8A15C'];

type SegmentedControlProps = {
  index: number;
  onChange: (index: number) => void;
};

function SegmentedControl({ index, onChange }: SegmentedControlProps) {
  const theme = useTheme();
  return (
    <ThemedView style={{ alignItems: 'center', paddingVertical: Spacing.three }}>
      <Host matchContents colorScheme="dark">
        <Picker
          selection={index}
          onSelectionChange={onChange}
          modifiers={[pickerStyle('segmented'), controlSize('extraLarge')]}>
          <Text modifiers={[tag(0), foregroundStyle(theme.text)]}>Top Rated</Text>
          <Text modifiers={[tag(1), foregroundStyle(theme.text)]}>Worst Rated</Text>
        </Picker>
      </Host>
    </ThemedView>
  );
}

type LeaderboardRowProps = {
  placement: number;
  photo: Photo;
};

function LeaderboardRow({ placement, photo }: LeaderboardRowProps) {
  const theme = useTheme();
  const medal = medalColors[placement - 1];

  return (
    <View style={styles.row}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.imageWrapper}>
          <Image source={{ uri: photo.img }} style={styles.thumbnail} contentFit="cover" transition={200} />
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
            <ThemedText type="small" style={{ color: '#F87171' }}>{photo.loses} loses</ThemedText>
          </ThemedText>
        </View>
      </ThemedView>
    </View>
  );
}

export default function RankingScreen() {
  const [tab, setTab] = useState(0);
  const sortedPhotos = photos;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <SegmentedControl index={tab} onChange={setTab} />
        <FlatList
          data={sortedPhotos}
          keyExtractor={(photo) => photo.id}
          renderItem={({ item, index }) => <LeaderboardRow placement={index + 1} photo={item} />}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
