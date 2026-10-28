import { MediaViewer } from 'expo-media-viewer';
import { View } from 'react-native';

type ExpandableImageProps = {
  thumbnailUrl: string;
  imageUrl: string;
  borderRadius?: number;
};

export function ExpandableImage({ thumbnailUrl, imageUrl, borderRadius = 0 }: ExpandableImageProps) {
  return (
    <View style={{ flex: 1 }}>
      <MediaViewer
        items={[{ type: 'image', source: imageUrl, thumbnail: { source: thumbnailUrl } }]}
        config={{ theme: 'dark', thumbnail: { fit: 'cover' } }}
        renderLayout={({ renderItem }) =>
          renderItem(0, { frame: { width: '100%', height: '100%', borderRadius } })
        }
      />
    </View>
  );
}
