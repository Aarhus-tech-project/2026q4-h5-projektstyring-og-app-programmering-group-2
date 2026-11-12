import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserPosts, getUserProfile } from '../../lib/api';

export default function UserProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const profileQuery = useQuery({ queryKey: ['user', userId], queryFn: () => getUserProfile(userId) });
  const postsQuery = useInfiniteQuery({
    queryKey: ['user', userId, 'posts'],
    queryFn: ({ pageParam }) => getUserPosts(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const profile = profileQuery.data;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), postsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (!profile) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.screen}>
          {profileQuery.isError ? (
            <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} retrying={profileQuery.isFetching} />
          ) : profileQuery.fetchStatus === 'paused' ? (
            <OfflineState />
          ) : (
            <ActivityIndicator style={styles.screen} color={theme.textSecondary} />
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const posts = postsQuery.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <FlatList
          data={posts}
          keyExtractor={(photo) => photo.id}
          numColumns={3}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Spacing.four }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
          onEndReached={() => postsQuery.hasNextPage && !postsQuery.isFetchingNextPage && postsQuery.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            postsQuery.isError ? (
              <ErrorState error={postsQuery.error} onRetry={() => postsQuery.refetch()} retrying={postsQuery.isFetching} />
            ) : postsQuery.isPending ? undefined : (
              <StateView
                icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                title="No photos yet"
                message={`${profile.username} hasn't uploaded any photos.`}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.gridItems}>
              <ExpandableImage thumbnailUrl={item.thumbnailUrl} imageUrl={item.imageUrl} thumbhash={item.thumbhash} user={profile} stats={{ wins: item.wins, losses: item.losses, elo: item.elo }} />
              <View style={styles.statsRow}>
                <ThemedView type="backgroundElement" style={styles.eloBorderMini}>
                  <ThemedText type="smallBold" style={styles.eloTextMini} adjustsFontSizeToFit>{Math.round(item.elo)}</ThemedText>
                </ThemedView>
              </View>
            </View>
          )}
          ListHeaderComponent={
            <>
              <View style={styles.username}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                  <SymbolView
                    name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                    tintColor={theme.text}
                    size={24}
                  />
                </Pressable>
                <ThemedText type="subtitle">{profile.username}</ThemedText>
              </View>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <ThemedView type="backgroundElement" style={styles.eloBorder}>
                    <ThemedText type="smallBold" style={styles.eloText} adjustsFontSizeToFit>{Math.round(profile.elo)} ELO</ThemedText>
                  </ThemedView>
                </View>
                <Avatar
                  thumbnailUrl={profile.avatarThumbnailUrl}
                  imageUrl={profile.avatarUrl}
                  thumbhash={profile.avatarThumbhash}
                />
              </View>
              {profile.description && (
                <ThemedView type="backgroundElement" style={[styles.textBox, { borderColor: theme.border }]}>
                  <ThemedText style={styles.textBoxText}>{profile.description}</ThemedText>
                </ThemedView>
              )}
              <View style={[styles.divider, { borderColor: theme.border }]} />
            </>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  username: {
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerLeft: {
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBox: {
    minHeight: 104,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    marginHorizontal: Spacing.six,
  },
  textBoxText: {
    textAlign: 'center',
  },
  divider: {
    borderBottomWidth: 1,
    marginTop: Spacing.four,
  },
  gridItems: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },
  eloBorder: {
    borderWidth: 1,
    borderColor: '#FFD84D',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  eloText: {
    color: '#FFD84D',
    fontSize: 24,
    lineHeight: 30,
  },
  eloBorderMini: {
    borderWidth: 1,
    borderColor: '#FFD84D',
    borderRadius: 999,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  eloTextMini: {
    color: '#FFD84D',
    fontSize: 10,
    lineHeight: 10,
  },
  statsRow: {
    position: 'absolute',
    left: Spacing.one,
    bottom: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  statsTextMini: {
    fontSize: 12,
    lineHeight: 12,
  },
});