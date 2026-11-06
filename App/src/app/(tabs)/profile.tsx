import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { ModalDescription } from '@/components/ui/modalDescription';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFavorites } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAssets } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { getMyProfile, signOut, updateDescription, uploadAvatar } from '../../../lib/api';
import { useAuthStatus } from '../../../lib/auth';
import { errorMessage } from '../../../lib/errors';

function ProfileSkeleton() {
  return (
    <View>
      <View style={styles.username}>
        <Skeleton style={{ width: 140, height: 22 }} />
      </View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Skeleton style={{ width: 140, height: 46, borderRadius: 999 }} />
          <Skeleton style={{ width: 90, height: 14 }} />
        </View>
        <Skeleton style={{ width: 110, height: 110, borderRadius: 55 }} />
      </View>
      <Skeleton style={{ height: 104, borderRadius: 14 }} />
      <View style={styles.skeletonGrid}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={styles.gridItems}>
            <Skeleton style={{ flex: 1, borderRadius: 0 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Profile() {
  const theme = useTheme()
  const [tab, setTab] = useState<'photos' | 'favorites'>('photos')
  const [editing, setEditing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()
  const auth = useAuthStatus()

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: getMyProfile,
    enabled: auth === 'signedIn',
  })
  const profile = profileQuery.data
  const favoritesQuery = useFavorites()
  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['profile'] }, { cancelRefetch: false })
    queryClient.invalidateQueries({ queryKey: ['favorites'] }, { cancelRefetch: false })
  }, [queryClient]))
  const [defaultAvatar] = useAssets(require('@/assets/images/default-avatar.jpg'))
  const defaultAvatarUri = defaultAvatar?.[0]?.localUri ?? defaultAvatar?.[0]?.uri
  const avatarUrl = profile?.avatarUrl ?? defaultAvatarUri
  const avatarThumbnailUrl = profile?.avatarThumbnailUrl ?? defaultAvatarUri

  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      toast.success('Profile picture updated')
      return queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not update your profile picture.')),
  })

  const descriptionMutation = useMutation({
    mutationFn: updateDescription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
    onError: (error) => toast.error(errorMessage(error, 'Could not save your description.')),
  })

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onError: () => toast.error('Logged out on this device, but the server could not be reached.'),
  })

  async function onRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([profileQuery.refetch(), favoritesQuery.refetch()])
    } finally {
      setRefreshing(false)
    }
  }

  async function editAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    avatarMutation.mutate(result.assets[0].uri);
  }

  async function saveDescription(text: string) {
    await descriptionMutation.mutateAsync(text)
  }

  if (!profile) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.scrollable}>
          {profileQuery.isError ? (
            <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} retrying={profileQuery.isFetching} />
          ) : profileQuery.fetchStatus === 'paused' ? (
            <OfflineState />
          ) : (
            <ProfileSkeleton />
          )}
        </SafeAreaView>
      </ThemedView>
    )
  }


  const posts = tab === 'photos' ? (profile?.posts ?? []) : (favoritesQuery.data ?? [])
  return (
    <ThemedView style={styles.screen}>
    <SafeAreaView style={styles.scrollable}>
    <FlatList
      data={posts}
      keyExtractor={(photo) => photo.id}
      numColumns={3}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: BottomTabInset + Spacing.four }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
      ListEmptyComponent={
        tab === 'photos' ? (
          <StateView
            icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
            title="No photos yet"
            message="Photos you upload from the Camera tab show up here."
          />
        ) : favoritesQuery.isError ? (
          <ErrorState error={favoritesQuery.error} onRetry={() => favoritesQuery.refetch()} retrying={favoritesQuery.isFetching} />
        ) : favoritesQuery.isPending ? undefined : (
          <StateView
            icon={{ ios: 'star', android: 'star', web: 'star' }}
            title="No favorites yet"
            message="Star photos while voting to save them here."
          />
        )
      }
      renderItem={({ item }) => (
        <View style={styles.gridItems}>
          <ExpandableImage thumbnailUrl={item.thumbnailUrl} imageUrl={item.imageUrl} thumbhash={item.thumbhash} />
        </View>
      )}
      ListHeaderComponent={
        <>
          <View style={styles.username} >
          <ThemedText type='subtitle'>{profile?.username}</ThemedText>
          </View>
          <View style={styles.header}>
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.menuButton}>
              <SymbolView name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} tintColor={theme.text} size={24} />
            </Pressable>

            <View style={styles.headerLeft}>
              <ThemedView type="backgroundElement" style={styles.eloBorder}>
                <ThemedText type="smallBold" style={styles.eloText} adjustsFontSizeToFit>{Math.round(Number(profile?.elo ?? 1500))} ELO</ThemedText>
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                <ThemedText type="smallBold" style={{ color: '#4ADE80' }}>{profile?.wins ?? 0} W</ThemedText>
                {'  ·  '}
                <ThemedText type="smallBold" style={{ color: '#F87171' }}>{profile?.losses ?? 0} L</ThemedText>
              </ThemedText>
            </View>

            <View style={styles.headerRight}>
              <View style={[styles.profilePic, { borderColor: theme.border }]}>
                {avatarUrl && avatarThumbnailUrl && (
                  <ExpandableImage thumbnailUrl={avatarThumbnailUrl} imageUrl={avatarUrl} borderRadius={55} />
                )}
                {avatarMutation.isPending && (
                  <View style={styles.avatarBusy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Pressable onPress={editAvatar} disabled={avatarMutation.isPending} style={styles.editBadge}>
                <ThemedView type="backgroundElement" style={[styles.editBadgeInner, { borderColor: theme.border }]}>
                  <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={theme.text} size={14} />
                </ThemedView>
              </Pressable>
            </View>
          </View>
         <Pressable onPress={() => setEditing(true)}>
            <ThemedView type="backgroundElement" style={[styles.TextBox, { borderColor: theme.border }]}>
              <ThemedText style={styles.TextBoxText} themeColor={profile.description ? 'text' : 'textSecondary'}>
                {profile.description || 'Tap to add a description'}
              </ThemedText>
              <SymbolView
                name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                tintColor={theme.textSecondary}
                size={14}
                style={styles.descriptionEditIcon}
              />
            </ThemedView>
          </Pressable>
          <View style={[styles.body, {borderColor: theme.border}]}>
            <Pressable style={styles.tab} onPress={() => setTab('photos')}>
              <SymbolView
                name={{ ios: 'photo', android: 'image', web: 'image' }}
                tintColor={tab === 'photos' ? theme.text : theme.textSecondary}
                size={32}
              />
            </Pressable>
            <View style={[styles.line, {borderColor: theme.border}]}></View>
            <Pressable style={styles.tab} onPress={() => setTab('favorites')}>
              <SymbolView
                name={{ ios: tab === 'favorites' ? 'star.fill' : 'star', android: 'star', web: 'star' }}
                tintColor={tab === 'favorites' ? '#FFD84D' : theme.textSecondary}
                size={32}
              />
            </Pressable>
          </View>
        </>
      }
    />
    {editing && (
  <ModalDescription
    description={profile?.description}
    onSave={saveDescription}
    onClose={() => setEditing(false)}
  />
  
)}
  {settingsOpen && (
    <>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={() => setSettingsOpen(false)} />
      </Animated.View>
      <Animated.View
        entering={SlideInLeft}
        exiting={SlideOutLeft}
        style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <ThemedText type="subtitle">Settings</ThemedText>
        <Pressable onPress={() => signOutMutation.mutate()} disabled={signOutMutation.isPending}>
          {signOutMutation.isPending
            ? <ActivityIndicator color="#F87171" style={{ alignSelf: 'flex-start' }} />
            : <ThemedText style={{ color: '#F87171' }}>Log out</ThemedText>}
        </Pressable>
      </Animated.View>
    </>
  )}

    </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },

  gridItems: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
  },
  line: {
    width: 1,
    alignSelf: 'stretch',
    borderWidth: 1,
  },
  favorite: {
    
  },
  profilePicPressed: {
  ...StyleSheet.absoluteFill,
  borderRadius: 55,
  backgroundColor: 'rgba(0, 0, 0, 0.35)',
},

  scrollable: {
    flex: 1,
  },

  username: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  screen: {
    flex: 1,
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
  headerRight: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },

  TextBox: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 104,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    marginHorizontal: Spacing.six,

  },
  TextBoxText: {
    textAlign: 'center',
    color: 'white'
  },
  profilePic: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
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

  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  collapsibleContent: {
    alignItems: 'center',
  },
  imageTutorial: {
    width: '100%',
    aspectRatio: 296 / 171,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  imageReact: {
    width: 100,
    height: 100,
    alignSelf: 'center',
  },
  editBadge: {
  position: 'absolute',
  right: 0,
  bottom: 0,
  },
  editBadgeInner: {
    width: 35,
    height: 35,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBusy: {
    ...StyleSheet.absoluteFill,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.six,
  },
  backdrop: {
  ...StyleSheet.absoluteFill,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    top: 25,
    bottom: 0,
    left: 0,
    width: '37%',
    padding: Spacing.four,
    gap: Spacing.three,
    borderRightWidth: 1,
  },
  menuButton: {
  alignSelf: 'flex-start',
  },
  descriptionEditIcon: {
  position: 'absolute',
  top: Spacing.two,
  right: Spacing.two,
},

});
