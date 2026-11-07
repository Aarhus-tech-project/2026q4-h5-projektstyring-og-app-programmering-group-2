import { ThemedView } from '@/components/themed-view';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { useTheme } from '@/hooks/use-theme';
import { useAssets } from 'expo-asset';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

type AvatarProps = {
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  thumbhash?: string | null;
  size?: number;
  busy?: boolean;
  expandable?: boolean;
  onEdit?: () => void;
};

export function Avatar({ thumbnailUrl, imageUrl, thumbhash, size = 110, busy = false, expandable = true, onEdit }: AvatarProps) {
  const theme = useTheme();
  const [defaultAvatar] = useAssets(require('@/assets/images/default-avatar.jpg'));
  const defaultUri = defaultAvatar?.[0]?.localUri ?? defaultAvatar?.[0]?.uri;

  const hasOwn = !!imageUrl && !!thumbnailUrl;
  const full = hasOwn ? imageUrl : defaultUri;
  const thumb = hasOwn ? thumbnailUrl : defaultUri;
  const radius = size / 2;

  return (
    <View>
      <View style={[styles.circle, { width: size, height: size, borderRadius: radius, borderColor: theme.border }]}>
        {full && thumb && (expandable ? (
          <ExpandableImage
            thumbnailUrl={thumb}
            imageUrl={full}
            thumbhash={hasOwn ? thumbhash : null}
            borderRadius={radius}
          />
        ) : (
          <Image
            source={{ uri: thumb }}
            placeholder={hasOwn && thumbhash ? { thumbhash } : undefined}
            contentFit="cover"
            transition={200}
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          />
        ))}
        {busy && (
          <View style={[styles.busy, { borderRadius: radius }]}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </View>
      {onEdit && (
        <Pressable onPress={onEdit} disabled={busy} style={styles.editBadge}>
          <ThemedView type="backgroundElement" style={[styles.editBadgeInner, { borderColor: theme.border }]}>
            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={theme.text} size={14} />
          </ThemedView>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
  },
  busy: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
