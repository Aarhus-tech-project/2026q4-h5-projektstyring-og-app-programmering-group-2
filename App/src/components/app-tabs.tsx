import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
        <NativeTabs.Trigger name="ranking">
          <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "trophy", selected: "trophy.fill" }} md="leaderboard" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="vote">
          <NativeTabs.Trigger.Label>Vote</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "rectangle.split.2x1", selected: "rectangle.split.2x1.fill" }} md="compare" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="camera">
          <NativeTabs.Trigger.Label>Camera</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "camera", selected: "camera.fill" }} md="photo_camera" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        </NativeTabs.Trigger>
        
        <NativeTabs.Trigger name="login">
          <NativeTabs.Trigger.Label>login</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="account_circle" />
        </NativeTabs.Trigger>
    </NativeTabs>
  );
}
