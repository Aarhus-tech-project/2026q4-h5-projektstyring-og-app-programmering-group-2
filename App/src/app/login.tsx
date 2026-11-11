import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandMark } from '@/components/ui/brand';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import * as Device from 'expo-device';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, TextInput, useColorScheme, View, type TextInputInstance } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { login, register } from '../../lib/api';
import { peekPendingRoute, setPendingRoute, takePendingRoute } from '../../lib/auth';
import { ApiError, errorMessage } from '../../lib/errors';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const REASONS: Record<string, string> = {
  vote: 'You need an account to vote on photos.',
  camera: 'You need an account to post photos.',
  profile: 'You need an account to have a profile.',
};

const COPY = {
  login: {
    title: 'Welcome back',
    body: 'Log in to vote on matchups, post photos and see how yours rank.',
  },
  register: {
    title: 'Create an account',
    body: 'Post your photos, vote on head-to-head matchups and climb the rankings.',
  },
};

function joinList(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function passwordProblem(password: string, username: string, email: string) {
  if (!password) return null;
  const missing = [
    ...(password.length < 8 ? ['8+ characters'] : []),
    ...(/[0-9]/.test(password) ? [] : ['a number']),
    ...(/[^a-zA-Z0-9]/.test(password) ? [] : ['a symbol']),
  ];
  if (missing.length) return `Needs ${joinList(missing)}`;
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "Can't contain your username";
  if (email && password.toLowerCase() === email.toLowerCase()) return "Can't be your email";
  return null;
}

function usernameProblem(username: string) {
  if (!username) return null;
  if (username.length < 3) return 'At least 3 characters';
  if (username.length > 32) return 'At most 32 characters';
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return 'Only letters, numbers, . _ or -';
  return null;
}

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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason] = useState(() => REASONS[peekPendingRoute() ?? '']);
  const usernameInput = useRef<TextInputInstance>(null);
  const passwordInput = useRef<TextInputInstance>(null);
  const repeatInput = useRef<TextInputInstance>(null);
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const keyboardTarget = useSharedValue(0);
  const introHeight = useSharedValue(0);
  const [introMeasured, setIntroMeasured] = useState(false);
  const [typing, setTyping] = useState(false);

  const registering = tab === 'register';
  const usernameIssue = registering ? usernameProblem(username.trim()) : null;
  const passwordIssue = registering ? passwordProblem(password, username.trim(), email.trim()) : null;
  const repeatIssue = registering && repeatPassword && repeatPassword !== password ? "Passwords don't match" : null;
  const missingFields = !email.trim() || !password || (registering && (!username.trim() || !repeatPassword));
  const blocked = missingFields || !!usernameIssue || !!passwordIssue || !!repeatIssue;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardTarget.set(event.endCoordinates.height);
      setTyping(true);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardTarget]);

  const progress = useDerivedValue(() => {
    const height = keyboard.height.value;
    const target = Math.max(keyboardTarget.get(), height);
    return target > 0 ? Math.min(1, height / target) : 0;
  });

  const keyboardSpace = useAnimatedStyle(() => ({
    paddingBottom: Math.max(Spacing.four, keyboard.height.value - insets.bottom + Spacing.two),
  }));
  const introStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const natural = introHeight.get();
    return {
      height: natural > 0 ? natural * (1 - p) : undefined,
      marginBottom: Spacing.four * (1 - p),
      opacity: Math.max(0, 1 - p * 1.6),
      transform: [{ translateY: -12 * p }],
    };
  });
  const lowerSpacer = useAnimatedStyle(() => ({ flexGrow: 1 - progress.get() }));

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  function close() {
    setPendingRoute(null);
    router.back();
  }

  async function submit() {
    if (blocked || submitting) return;
    setSubmitting(true);
    setError(null);
    let registered = false;
    try {
      if (registering) {
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
        <View style={styles.topRow}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
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
          <SegmentedControl
            values={['Log in', 'Register']}
            selectedIndex={registering ? 1 : 0}
            onChange={(event) => {
              setTab(event.nativeEvent.selectedSegmentIndex === 1 ? 'register' : 'login');
              setError(null);
            }}
            appearance={scheme}
            style={styles.segmented}
          />
          <View style={styles.close} />
        </View>

        <Pressable style={styles.screen} onPress={Keyboard.dismiss} accessible={false}>
          <Animated.View style={[styles.container, keyboardSpace]}>
            <View style={styles.spacer} />
            <Animated.View style={[styles.introClip, introStyle]}>
              <View
                style={[styles.intro, introMeasured && styles.introPinned]}
                onLayout={(event) => {
                  introHeight.set(event.nativeEvent.layout.height);
                  setIntroMeasured(true);
                }}>
                <BrandMark size={64} />
                <ThemedText type="subtitle">{COPY[tab].title}</ThemedText>
                <ThemedText themeColor="textSecondary">{COPY[tab].body}</ThemedText>
                {reason && (
                  <View style={[styles.reason, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={theme.textSecondary} size={14} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.reasonText}>{reason}</ThemedText>
                  </View>
                )}
              </View>
            </Animated.View>

            <View style={styles.form}>
              <View>
                <FieldLabel text="Email" progress={progress} />
                <TextInput
                  style={inputStyle}
                  placeholder={typing ? 'Email' : 'you@example.com'}
                  accessibilityLabel="Email"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => (registering ? usernameInput : passwordInput).current?.focus()}
                  editable={!submitting}
                />
              </View>

              {registering && (
                <View>
                  <FieldLabel text="Username" issue={usernameIssue} progress={progress} />
                  <TextInput
                    ref={usernameInput}
                    style={inputStyle}
                    placeholder={typing ? 'Username' : 'AmazingFox23'}
                    accessibilityLabel="Username"
                    placeholderTextColor={theme.textSecondary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    textContentType="username"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    editable={!submitting}
                  />
                </View>
              )}

              <View>
                <FieldLabel text="Password" issue={passwordIssue} progress={progress} />
                <TextInput
                  ref={passwordInput}
                  style={inputStyle}
                  placeholder={typing ? 'Password' : '••••••••'}
                  accessibilityLabel="Password"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  textContentType={registering ? 'newPassword' : 'password'}
                  returnKeyType={registering ? 'next' : 'go'}
                  submitBehavior={registering ? 'submit' : 'blurAndSubmit'}
                  onSubmitEditing={() => (registering ? repeatInput.current?.focus() : submit())}
                  editable={!submitting}
                />
              </View>

              {registering && (
                <View>
                  <FieldLabel text="Repeat password" issue={repeatIssue} progress={progress} />
                  <TextInput
                    ref={repeatInput}
                    style={inputStyle}
                    placeholder={typing ? 'Repeat password' : '••••••••'}
                    accessibilityLabel="Repeat password"
                    placeholderTextColor={theme.textSecondary}
                    value={repeatPassword}
                    onChangeText={setRepeatPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    editable={!submitting}
                  />
                </View>
              )}

              {error && (
                <ThemedText type="small" style={styles.error} accessibilityRole="alert">{error}</ThemedText>
              )}

              <Pressable
                onPress={submit}
                disabled={blocked || submitting}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.text },
                  (pressed || blocked) && styles.pressed,
                ]}>
                {submitting ? (
                  <ActivityIndicator color={theme.background} />
                ) : (
                  <ThemedText style={{ color: theme.background }} type="smallBold">
                    {registering ? 'Create account' : 'Log in'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
            <Animated.View style={lowerSpacer} />
          </Animated.View>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const LABEL_HEIGHT = 20;
const LABEL_GAP = 6;

function FieldLabel({ text, issue, progress }: { text: string; issue?: string | null; progress: SharedValue<number> }) {
  const pinned = !!issue;
  const rowStyle = useAnimatedStyle(() => {
    const hidden = pinned ? 0 : progress.get();
    return {
      height: LABEL_HEIGHT * (1 - hidden),
      marginBottom: LABEL_GAP * (1 - hidden),
      opacity: Math.max(0, 1 - hidden * 1.6),
    };
  });

  return (
    <Animated.View style={[styles.labelRow, rowStyle]}>
      <ThemedText type="smallBold">{text}</ThemedText>
      {issue && (
        <View style={styles.issue} accessibilityLiveRegion="polite">
          <SymbolView name={{ ios: 'exclamationmark.circle', android: 'error', web: 'error' }} tintColor="#F59E0B" size={13} />
          <ThemedText type="small" style={styles.issueText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {issue}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  spacer: {
    flexGrow: 1,
  },
  introClip: {
    overflow: 'hidden',
  },
  intro: {
    gap: Spacing.two,
  },
  introPinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  reasonText: {
    flex: 1,
  },
  form: {
    gap: Spacing.three,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    overflow: 'hidden',
  },
  input: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  issue: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 4,
  },
  issueText: {
    flexShrink: 1,
    color: '#F59E0B',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Spacing.three,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: '#F87171',
  },
});
