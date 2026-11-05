import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { ModalDescription } from '@/components/ui/modalDescription';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyProfile, Profile as ProfileData, updateDescription, uploadAvatar } from '../../lib/api';



export default function Profile() {
  const theme = useTheme()
  const [tab, setTab] = useState<'photos' | 'favorites'>('photos')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editing, setEditing] = useState(false)


  useFocusEffect(useCallback(() => {
    getMyProfile().then(setProfile)
      .catch((error) => console.error('Failed to load profile posts', error))
  }, []))

  async function editAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    try {
      await uploadAvatar(asset.uri);
      setProfile(await getMyProfile());
    } catch (error) {
      console.error('Failed to upload avatar', error)
    }
  }

  async function saveDescription(text: string) {
  try {
    await updateDescription(text)
    setProfile(await getMyProfile())
  } catch (error) {
    console.error('Failed to update description', error)
  }
}


  const posts = tab === 'photos' ? (profile?.posts ?? []) : []
  return (
    <ThemedView style={styles.screen}>
    <SafeAreaView style={styles.scrollable}>
    <FlatList
      data={posts}
      keyExtractor={(photo) => photo.id}
      numColumns={3}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
      renderItem={({ item }) => (
        <View style={styles.gridItems}>
          <ExpandableImage thumbnailUrl={item.thumbnailUrl} imageUrl={item.imageUrl} />
        </View>
      )}
      ListHeaderComponent={
        <>
          <View style={styles.username} >
          <ThemedText type='subtitle'>{profile?.username}</ThemedText>
          </View>
          <View style={styles.header}>
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
              {profile?.avatarUrl && profile.avatarThumbnailUrl && (
                <ExpandableImage thumbnailUrl={profile.avatarThumbnailUrl} imageUrl={profile.avatarUrl} borderRadius={55} />
              )}
            </View>
            <Pressable onPress={editAvatar} style={styles.editBadge}>
            <ThemedView type="backgroundElement" style={[styles.editBadgeInner, { borderColor: theme.border }]}>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={theme.text} size={14} />
            </ThemedView>
          </Pressable>
            </View>
          </View>
         <Pressable onPress={() => setEditing(true)}>
          <ThemedView type="backgroundElement" style={[styles.TextBox, { borderColor: theme.border }]}>
            <ThemedText style={styles.TextBoxText} themeColor={profile?.description ? 'text' : 'textSecondary'}>
              {profile?.description || 'Hi. Welcome to my profile'}
            </ThemedText>
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
});
