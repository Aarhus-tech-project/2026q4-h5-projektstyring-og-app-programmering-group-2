import { Image } from 'expo-image';
import { MediaUser, MediaViewer } from './media-viewer';
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from 'react-native';



type ExpandableImageProps = {
  thumbnailUrl: string;
  imageUrl: string;
  thumbhash?: string | null;
  borderRadius?: number;
  user?: MediaUser;
};

const SHOW_ONLY_THUMBHASH = false;

export function ExpandableImage({ thumbnailUrl, imageUrl, thumbhash, borderRadius = 0, user }: ExpandableImageProps) {
  const [expanded, setExpanded] = useState(false);

  if (SHOW_ONLY_THUMBHASH && thumbhash) {
    return (
      <Pressable style={{ flex: 1 }} onPress={() => setExpanded(true)}>
        <Image source={{ thumbhash }} contentFit="cover" style={[StyleSheet.absoluteFill, { borderRadius }]} />
        <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
          <Pressable style={styles.fullscreen} onPress={() => setExpanded(false)}>
            <Image source={{ thumbhash }} contentFit="contain" style={StyleSheet.absoluteFill} />
          </Pressable>
        </Modal>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {thumbhash && (
        <Image
          source={{ thumbhash }}
          contentFit="cover"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}
      <MediaViewer
        items={[{ type: 'image', source: imageUrl, thumbnail: { source: thumbnailUrl } }]}
        config={{ theme: 'dark', thumbnail: { fit: 'cover' } }}
        user={user}
        renderLayout={({ renderItem }) =>
          renderItem(0, {
            frame: {
              width: '100%',
              height: '100%',
              borderRadius,
              backgroundColor: thumbhash ? 'transparent' : undefined,
            },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000',
  },
});
