import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@expo/ui/community/segmented-control'

export default function LoginScreen() {
  const [tab, setTab] = useState(0);
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [Username, setUsername] = useState('');

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}>

          <ThemedView style={styles.form}>
            <ThemedText type="smallBold">Email</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <ThemedText type="smallBold">Password</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder="••••••••"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            
             <View style={styles.usernameBox}>
              {tab === 1 && (
                <>
                  <ThemedText type="smallBold">Username</ThemedText>
                  <TextInput
                    style={inputStyle}
                    placeholder="AmazingFox23"
                    placeholderTextColor={theme.textSecondary}
                    value={Username}
                    onChangeText={setUsername}
                    autoComplete="username-new"
                  />
                </>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={{ color: theme.background }} type="smallBold">
                {tab === 1 ? 'Register' : 'Log in'}
              </ThemedText>
            </Pressable>
          </ThemedView>
            <SegmentedControl
                     values={['Login', 'Register']}
                     selectedIndex={tab}
                     onChange={(event) => setTab(event.nativeEvent.selectedSegmentIndex)}
                     appearance="dark"
                     style={styles.segmented}
                   />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  centerText: {
    textAlign: 'center',
  },
  segmented: {
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.three,
  },
  input: {
    height: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  usernameBox: {
    height: 52 + Spacing.two + 52 + Spacing.two, // label + gap + input + marginBottom
    gap: Spacing.two,
  },

});
