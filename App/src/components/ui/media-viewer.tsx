import { BlurView } from "expo-blur";
import { Image, ImageContentFit } from "expo-image";
import { ReactNode, useState } from "react";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DimensionValue, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
} from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

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
const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
const IMAGE_HEIGHT = 500;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

export function MediaViewer({ items, config, renderLayout }: MediaViewerProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openItem = openIndex !== null ? items[openIndex] : null;
  const insets = useSafeAreaInsets();

  const { width: screenWidth } = useWindowDimensions();

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const open = (index: number) => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setOpenIndex(index);
  };

  const close = () => {
    setOpenIndex(null);
  };

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
      if (scale.value > 1) {
      translateX.value += e.changeX;
      translateY.value += e.changeY;
    } else {
      translateY.value += e.changeY;
    }
  },
    onDeactivate: (e) => {
      if (scale.value > 1) {
        clampPosition(scale.value);
        return;
      }

      const farEnough = Math.abs(translateY.value) > DISMISS_DISTANCE;
      const fastEnough = Math.abs(e.velocityY) > DISMISS_VELOCITY;

      if (farEnough || fastEnough) {
        const direction = translateY.value > 0 ? 1 : -1;
        translateY.value = withTiming(direction * 1000, {duration: 200}, () => {
          scheduleOnRN(close);
        });
      } else {
        translateY.value = withTiming(0);
      }

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
  
  const backdropStyle = useAnimatedStyle(() => ({
  opacity: scale.value > 1 ? 1 : interpolate(Math.abs(translateY.value), [0, 300], [1, 0]),
  }));


  const renderItem: RenderItem = (index, options) => {
    const item = items[index];
    return (
      <Pressable
        key={index}
        style={[options?.frame, { overflow: "hidden" }]}
        onPress={() => open(index)}
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
          <View style={styles.backdrop}>
            <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
              <BlurView intensity={60} tint={tint} style={StyleSheet.absoluteFill} />
            </Animated.View>

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

            <Animated.View style={[styles.closeWrapper, { top: insets.top + 8 }, backdropStyle]}>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                {useGlass ? (
                  <GlassView style={styles.closeButton} glassEffectStyle="regular" isInteractive>
                    <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor="#fff" />
                  </GlassView>
                ) : (
                  <BlurView intensity={40} tint={tint} style={styles.closeButton}>
                    <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor="#fff" />
                  </BlurView>
                )}
              </Pressable>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center" },
  image: { width: "100%", height: IMAGE_HEIGHT },

  closeWrapper: { position: "absolute", right: 16 },
  closeButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
},

});

