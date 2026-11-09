import { BlurView } from "expo-blur";
import { Image, ImageContentFit } from "expo-image";
import { ReactNode, useState } from "react";
import { DimensionValue, Modal, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
} from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export type MediaItem = {
  type: "image";
  source: string;
  thumbnail?: { source: string };
};

type Frame = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  backgroundColor?: string;
};

type MediaViewerConfig = {
  theme?: "dark" | "light";
  thumbnail?: { fit?: ImageContentFit };
};

type RenderItem = (index: number, options?: { frame?: Frame }) => ReactNode;

type MediaViewerProps = {
  items: MediaItem[];
  config?: MediaViewerConfig;
  renderLayout: (helpers: { renderItem: RenderItem }) => ReactNode;
};

const IMAGE_HEIGHT = 500;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function MediaViewer({ items, config, renderLayout }: MediaViewerProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openItem = openIndex !== null ? items[openIndex] : null;

  const { width: screenWidth } = useWindowDimensions();

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const close = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setOpenIndex(null);
  };

  // Keeps the image from being dragged past its edges.
  // targetScale is the scale the image is settling at (it may still be animating there).
  const clampPosition = (targetScale: number) => {
    "worklet";
    const maxX = (screenWidth * (targetScale - 1)) / 2;
    const maxY = (IMAGE_HEIGHT * (targetScale - 1)) / 2;
    translateX.value = withTiming(Math.min(maxX, Math.max(-maxX, translateX.value)));
    translateY.value = withTiming(Math.min(maxY, Math.max(-maxY, translateY.value)));
  };

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      scale.value *= e.scaleChange;
    },
    onDeactivate: () => {
      const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value));
      scale.value = withTiming(target);
      clampPosition(target);
    },
  });

  const pan = usePanGesture({
    onUpdate: (e) => {
      if (scale.value <= 1) return; // not zoomed: don't move
      translateX.value += e.changeX;
      translateY.value += e.changeY;
    },
    onDeactivate: () => {
      clampPosition(scale.value);
    },
  });

  const gestures = useSimultaneousGestures(pinch, pan);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const renderItem: RenderItem = (index, options) => {
    const item = items[index];
    return (
      <Pressable
        key={index}
        style={[options?.frame, { overflow: "hidden" }]}
        onPress={() => setOpenIndex(index)}
      >
        <Image
          source={{ uri: item.thumbnail?.source ?? item.source }}
          contentFit={config?.thumbnail?.fit ?? "cover"}
          style={StyleSheet.absoluteFill}
        />
      </Pressable>
    );
  };

  const tint = config?.theme === "light" ? "light" : "dark";

  return (
    <>
      {renderLayout({ renderItem })}

      <Modal visible={openItem !== null} transparent animationType="fade" onRequestClose={close}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={close}>
            <BlurView intensity={60} tint={tint} style={StyleSheet.absoluteFill} />
            {openItem && (
              <GestureDetector gesture={gestures}>
                <Animated.View style={zoomStyle}>
                  <Image
                    source={{ uri: openItem.source }}
                    placeholder={{ uri: openItem.thumbnail?.source }}
                    contentFit="cover"
                    style={styles.image}
                  />
                </Animated.View>
              </GestureDetector>
            )}
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center" },
  image: { width: "100%", height: IMAGE_HEIGHT },
});
