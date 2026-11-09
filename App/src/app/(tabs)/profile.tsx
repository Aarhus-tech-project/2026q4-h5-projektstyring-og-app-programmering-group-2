import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { ModalDescription } from '@/components/ui/modalDescription';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState, StateView } from '@/components/ui/state-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFavorites } from '@/hooks/use-favorites';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Switch, useColorScheme, useWindowDimensions, View, type HostInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { getMyProfile, signOut, updateDescription, uploadAvatar } from '../../../lib/api';
import { setAppearance } from '../../../lib/appearance';
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

const MENU_WIDTH = 160

type MenuOption = { label: string; onPress: () => void; destructive?: boolean }

function PhotoMenu({ options }: { options: MenuOption[] }) {
  const theme = useTheme()
  const { height } = useWindowDimensions()
  const ref = useRef<HostInstance>(null)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)

  const open = () =>
    ref.current?.measureInWindow((x, y, w, h) =>
      setPos({
        left: Math.max(Spacing.two, x + w - MENU_WIDTH),
        ...(y + h + 160 < height ? { top: y + h + Spacing.one } : { bottom: height - y + Spacing.one }),
      })
    )

  return (
    <>
      <Pressable ref={ref} onPress={open} hitSlop={8} style={styles.itemButton}>
        <SymbolView name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }} tintColor="#fff" size={16} />
      </Pressable>
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={() => setPos(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPos(null)} />
        {pos && (
          <ThemedView type="backgroundElement" style={[styles.menu, pos, { borderColor: theme.border }]}>
            {options.map((o) => (
              <Pressable
                key={o.label}
                onPress={() => { setPos(null); o.onPress() }}
                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                <ThemedText style={o.destructive && { color: '#EF4444' }}>{o.label}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}
      </Modal>
    </>
  )
}

export default function Profile() {
  const theme = useTheme()
  const [tab, setTab] = useState<'photos' | 'favorites'>('photos')
  const [editing, setEditing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
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
          {tab === 'photos' && (
            <PhotoMenu
              options={[
                { label: 'Share', onPress: () => {} },
                { label: 'Edit', onPress: () => {} },
                { label: 'Delete', onPress: () => {} },
              ]}
            />
          )}
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
                <ThemedText type="smallBold" style={styles.eloText} adjustsFontSizeToFit>{Math.round(profile?.elo ?? 1500)} ELO</ThemedText>
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                <ThemedText type="smallBold" style={{ color: '#4ADE80' }}>{profile?.wins ?? 0} W</ThemedText>
                {'  ·  '}
                <ThemedText type="smallBold" style={{ color: '#F87171' }}>{profile?.losses ?? 0} L</ThemedText>
              </ThemedText>
            </View>

            <View style={styles.headerRight}>
              <Avatar
                thumbnailUrl={profile.avatarThumbnailUrl}
                imageUrl={profile.avatarUrl}
                thumbhash={profile.avatarThumbhash}
                busy={avatarMutation.isPending}
                onEdit={editAvatar}
              />
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
        style={[
          styles.panel,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            paddingTop: insets.top + Spacing.three,
            paddingBottom: BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.panelHeader}>
          <ThemedText type="subtitle">Settings</ThemedText>
          <Pressable onPress={() => setSettingsOpen(false)} hitSlop={12}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.textSecondary} size={20} />
          </Pressable>
            </View>
            <View style={[styles.settingRow, { borderColor: theme.border }]}>
            <ThemedText style={{ flex: 1 }}>Dark mode</ThemedText>
            <Switch
            value={isDark}
            onValueChange={(on) => setAppearance(on ? 'dark' : 'light')}
            trackColor={{ true: '#2F9E44', false: theme.border }}
            />
        </View>


        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
          style={({ pressed }) => [styles.logoutButton, { borderColor: theme.border }, pressed && styles.pressed]}>
          {signOutMutation.isPending ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <>
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                tintColor="#EF4444"
                size={18}
              />
              <ThemedText type="smallBold" style={{ color: '#EF4444' }}>Log out</ThemedText>
            </>
          )}
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
    top: 0,
    bottom: 0,
    left: 0,
    width: '80%',
    maxWidth: 360,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    borderRightWidth: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  settingRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.three,
  paddingVertical: Spacing.three,
  borderTopWidth: 1,
  borderBottomWidth: 1,
},

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
  },

  menuButton: {
  alignSelf: 'flex-start',
  },
  descriptionEditIcon: {
  position: 'absolute',
  top: Spacing.two,
  right: Spacing.two,
},
  menu: {
  position: 'absolute',
  width: MENU_WIDTH,
  borderWidth: 1,
  borderRadius: 14,
  overflow: 'hidden',
},
  menuItem: {
  padding: Spacing.three,
},
  itemButton: {
  position: 'absolute',
  right: Spacing.one,
  bottom: Spacing.one,
  padding: Spacing.one,
  borderRadius: 999,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
},

});