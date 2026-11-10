import { router, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { Platform, PlatformColor, useColorScheme } from 'react-native';
import { toast } from 'sonner-native';

import { Colors } from '@/constants/theme';
import { setPendingRoute, useAuthStatus } from '../../lib/auth';
import { useConnectivity } from '../../lib/connectivity';
import { queryClient } from '../../lib/query';

const protectedTabs = ['vote', 'camera', 'profile'];

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const auth = useAuthStatus();
  const connectivity = useConnectivity();
  const segments = useSegments();
  const locked = auth !== 'signedIn';
  const currentTab = segments[1];

  useEffect(() => {
    if (auth !== 'signedOut') return;
    queryClient.removeQueries({ queryKey: ['matchup'] });
    queryClient.removeQueries({ queryKey: ['profile'] });
    queryClient.removeQueries({ queryKey: ['favorites'] });
    if (currentTab && protectedTabs.includes(currentTab)) router.navigate('/ranking');
  }, [auth, currentTab]);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: Platform.OS === 'ios' ? PlatformColor('label') : colors.text } }}
      screenListeners={({ route }) => ({
        tabPress: (event) => {
          if (!event.data.isPrevented || auth === 'unknown') return;
          if (connectivity !== 'online') {
            toast.error(connectivity === 'noInternet'
              ? "You're offline. Connect to the internet to log in."
              : "Can't reach the server, so you can't log in right now.");
            return;
          }
          setPendingRoute(route.name);
          router.push('/login');
        },
      })}>
        <NativeTabs.Trigger name="ranking">
          <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "trophy", selected: "trophy.fill" }} md="leaderboard" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="vote" disabled={locked}>
          <NativeTabs.Trigger.Label>Vote</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "rectangle.split.2x1", selected: "rectangle.split.2x1.fill" }} md="compare" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="camera" disabled={locked}>
          <NativeTabs.Trigger.Label>Camera</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "camera", selected: "camera.fill" }} md="photo_camera" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile" disabled={locked}>
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        </NativeTabs.Trigger>
    </NativeTabs>
  );
}
