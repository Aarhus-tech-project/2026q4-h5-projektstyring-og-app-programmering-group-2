import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/use-theme';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';

export default function Profile() {
  const theme = useTheme()
  const [tab, setTab] = useState<'photos' | 'favorites'>('photos')
  return (
    <ThemedView style={styles.screen}>
    <SafeAreaView style={styles.scrollable}>
    <ScrollView>
      <View style={styles.username} >
      <ThemedText type='subtitle'>Markus</ThemedText>
      </View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedView type="backgroundElement" style={styles.eloBorder}>
              <ThemedText type="smallBold" style={styles.eloText} adjustsFontSizeToFit>1239 ELO</ThemedText>
            </ThemedView>
           <ThemedText type="small" themeColor="textSecondary">
            <ThemedText type="smallBold" style={{ color: '#4ADE80' }}>43 W</ThemedText>
            {'  ·  '}
            <ThemedText type="smallBold" style={{ color: '#F87171' }}>17 L</ThemedText>
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
            <Image source={require('./Markus.png')} style={[styles.profilePic, { borderColor: theme.border }]} contentFit="cover"/>
        </View>
      </View>
       <ThemedView type="backgroundElement" style={[styles.TextBox, { borderColor: theme.border }]}>
        <TextInput style={styles.TextBoxText} editable={false} numberOfLines={12} multiline scrollEnabled={false}>Instragram.com/niclas Instragram.com/niclas Instragram.com/niclas Instragram.com/niclas Instragram.com/niclas Instragram.com/niclas Instragram.com/niclasnstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclasnstragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclasnstragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas nstragram.com/niclas Instragram.com/niclas</TextInput>
      </ThemedView>
      
      <View style={[styles.body, {borderColor: theme.border}]}>
        <Pressable style={styles.tab} onPress={()=> setTab('photos')}>
          <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }}
      tintColor={tab === 'photos' ? theme.text : theme.textSecondary}
      size={32}/>
        </Pressable>
        <View style={[styles.line, {borderColor: theme.border} ]}></View>
        <Pressable style={styles.tab} onPress={() => setTab('favorites')}>
    <SymbolView
      name={{ ios: tab === 'favorites' ? 'star.fill' : 'star', android: 'star', web: 'star' }}
      tintColor={tab === 'favorites' ? '#FFD84D' : theme.textSecondary}
      size={32}
    />
  </Pressable>
      </View>

    </ScrollView>
    </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
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
});
