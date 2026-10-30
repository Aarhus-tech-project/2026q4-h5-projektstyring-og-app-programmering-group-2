import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Device from 'expo-device';
import { router } from 'expo-router/build/global-state/router.js';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function LoginScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');


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

            {tab === 'register' && (
              <>
                <ThemedText type="smallBold">Username</ThemedText>
                <TextInput
                  style={inputStyle}
                  placeholder="AmazingFox23"
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoComplete="username-new"
                />
              </>
            )}

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

            <Pressable
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={{ color: theme.background }} type="smallBold">
                {tab === 'register' ? 'Register' : 'Log in'}
              </ThemedText>
            </Pressable>
          </ThemedView>
          <SegmentedControl
            values={['Login', 'Register']}
            selectedIndex={tab === 'register' ? 1 : 0}
            onChange={(event) => setTab(event.nativeEvent.selectedSegmentIndex === 1 ? 'register' : 'login')}
            appearance="dark"
            style={styles.segmented}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );

    async function submit() {
    console.log("goygoygoyogogoggogogoogogogoogogogogogogg")

    try {
      if (tab === "login") {
        console.log("login")

        const { data, error } = await api.POST("/api/Login/login", {
          body: {
            email,
            password,
            deviceName: Device.deviceName ?? "Unknown device",
            platform: Platform.OS,
          },
        });

        console.log("login before if error");

        if (error) {
          console.log(error);
          console.log(typeof error === "string" ? error : "Login failed");
          return;
        }

        await SecureStore.setItemAsync("refreshtoken", data.refreshToken);
        await SecureStore.setItemAsync("accesstoken", data.accessToken);
      } else {

        console.log("register")

        const { data, error } = await api.POST("/api/Login/register", {
          body: { email, username, password },
        });

        console.log("register before if error");

        if (error) {
          console.log(error);
          console.log(typeof error === "string" ? error : "Register failed");
          return;
        }

        console.log(typeof error === "string" ? error : "Login failed");
        console.log(typeof data === "string" ? data : "Login failed");
      }
      console.log("Success");
      router.back();
    } catch (e) {
      console.log(e);
      console.log(e instanceof Error ? e.message : "Request failed");
    }
  }
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
    height: 52 + Spacing.two + 52 + Spacing.two,
    gap: Spacing.two,
  },
});