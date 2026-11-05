import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Device from 'expo-device';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login, register } from '../../lib/api';
import { setPendingRoute, takePendingRoute } from '../../lib/auth';
import { ApiError, errorMessage } from '../../lib/errors';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

function loginErrorMessage(error: unknown, tab: 'login' | 'register') {
  if (error instanceof ApiError) {
    if (tab === 'login' && error.status === 401) return 'Wrong email or password.';
    if (error.status === 400 || error.status === 409) return error.message;
  }
  return errorMessage(error, tab === 'login' ? 'Could not log in.' : 'Could not create your account.');
}

export default function LoginScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingFields = !email.trim() || !password || (tab === 'register' && !username.trim());

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  function close() {
    setPendingRoute(null);
    router.back();
  }

  async function submit() {
    if (missingFields || submitting) return;
    setSubmitting(true);
    setError(null);
    let registered = false;
    try {
      if (tab === 'register') {
        await register(email.trim(), username.trim(), password);
        registered = true;
      }
      await login(email.trim(), password, Device.deviceName ?? 'Unknown device');
      const pending = takePendingRoute();
      router.back();
      if (pending) router.navigate(`/${pending}` as Href);
    } catch (e) {
      setError(loginErrorMessage(e, registered ? 'login' : tab));
      if (registered) setTab('login');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <Pressable onPress={close} hitSlop={8} style={styles.closeSlot} accessibilityLabel="Close">
          {useGlass ? (
            <GlassView style={styles.close} glassEffectStyle="regular" isInteractive>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
            </GlassView>
          ) : (
            <View style={[styles.close, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }]}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={theme.text} size={16} />
            </View>
          )}
        </Pressable>
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
              editable={!submitting}
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
                  editable={!submitting}
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
              autoCapitalize="none"
              autoComplete="password"
              editable={!submitting}
              onSubmitEditing={submit}
            />

            {error && (
              <ThemedText type="small" style={styles.error} accessibilityRole="alert">{error}</ThemedText>
            )}

            <Pressable
              onPress={submit}
              disabled={missingFields || submitting}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.text },
                (pressed || missingFields) && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText style={{ color: theme.background }} type="smallBold">
                  {tab === 'register' ? 'Register' : 'Log in'}
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
          <SegmentedControl
            values={['Login', 'Register']}
            selectedIndex={tab === 'register' ? 1 : 0}
            onChange={(event) => {
              setTab(event.nativeEvent.selectedSegmentIndex === 1 ? 'register' : 'login');
              setError(null);
            }}
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
  closeSlot: {
    alignSelf: 'flex-start',
    margin: Spacing.three,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  form: {
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#F87171',
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
});
