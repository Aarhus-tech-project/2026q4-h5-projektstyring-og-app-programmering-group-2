import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { ThemedText } from "../themed-text";
import { Avatar } from "./avatar";

export type MediaUser = {
  username: string;
  avatarThumbnailUrl: string | null;
  avatarUrl: string | null;
  avatarThumbhash: string | null;
  elo: number;
}

export type MediaStats = {
  wins: number;
  losses: number;
  elo: number;
};

type MediaViewerProps = {
  source: string;
  thumbnail?: string;
  borderRadius?: number;
  user?: MediaUser;
  stats?: MediaStats;
};

const tint = "dark";

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

export function MediaViewer({ source, thumbnail, borderRadius = 0, user, stats }: MediaViewerProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const deviceBottom = initialWindowMetrics?.insets.bottom ?? insets.bottom;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const open = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const clampPosition = (targetScale: number) => {
    "worklet";
    const maxX = (screenWidth * (targetScale - 1)) / 2;
    const maxY = (screenWidth * (targetScale - 1)) / 2;
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


  return (
    <>
      <TapThumbnail uri={thumbnail ?? source} borderRadius={borderRadius} onTap={open} />

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
              <BlurView intensity={60} tint={tint} style={StyleSheet.absoluteFill} />
            </Animated.View>

            <GestureDetector gesture={gestures}>
              <Animated.View style={zoomStyle}>
                <Image
                  source={{ uri: source }}
                  placeholder={thumbnail ? { uri: thumbnail } : undefined}
                  contentFit="contain"
                  style={{ width: screenWidth, height: screenWidth }}
                />
              </Animated.View>
            </GestureDetector>
            {stats && (

            <Animated.View style={[styles.statsWrapper, { top: (screenHeight + screenWidth) / 2 + Spacing.three }, backdropStyle]}>
              <View style={[styles.statsPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={styles.statsEloBorder}>
                  <ThemedText type="smallBold" style={styles.statsEloText}>{Math.round(stats.elo)} ELO</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  <ThemedText type="smallBold" style={{ color: '#4ADE80' }}>{stats.wins} W</ThemedText>
                  {'  ·  '}
                  <ThemedText type="smallBold" style={{ color: '#F87171' }}>{stats.losses} L</ThemedText>
                </ThemedText>
              </View>
            </Animated.View>
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
            {user && (
            <Animated.View
             style={[styles.barWrapper, { bottom: Math.max(deviceBottom - 15, 8) }, backdropStyle]}
            >
              <View style={[styles.bar, {backgroundColor: theme.backgroundElement, borderColor: theme.background}]}>
                {useGlass ? (
                  <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
                ) : (
                  <BlurView intensity={40} tint={tint} style={StyleSheet.absoluteFill} />
                )}

               <Avatar
                  thumbnailUrl={user.avatarThumbnailUrl}
                  imageUrl={user.avatarUrl}
                  thumbhash={user.avatarThumbhash}
                  size={52}
                  expandable={false}
                />
                <View style={styles.barText}>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.barName}>
                    {user.username}
                  </ThemedText>
                  <View style={styles.eloRow}>
                    <ThemedText type="small" style={styles.barElo}>{Math.round(user.elo)} Elo</ThemedText>
                  </View>
                </View>

              </View>
            </Animated.View>)}
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

// TEST: gesture-handler tap instead of Pressable, to see if it opens while a list is still scrolling.
function TapThumbnail({ uri, borderRadius, onTap }: { uri: string; borderRadius: number; onTap: () => void }) {
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: () => onTap(),
  });

  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.thumbnail, { borderRadius }]}>
        <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center" },
  thumbnail: { width: "100%", height: "100%", overflow: "hidden" },

  closeWrapper: { position: "absolute", right: 16 },
  closeButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
},

barWrapper: {
  position: "absolute",
  alignSelf: "center",
  maxWidth: "85%",
},
bar: {
  flexDirection: "row",
  alignItems: "center",
  gap: Spacing.two,
  paddingLeft: Spacing.one + 2,
  paddingRight: Spacing.three + 4,
  paddingVertical: Spacing.one + 2,
  borderRadius: 999,
  overflow: "hidden",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.2)",
},
barText: {
  flexShrink: 1,
},
barName: {
  lineHeight: 18,
  marginBottom: 4
},
eloRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: 'center',
  gap: Spacing.one,
},
barElo: {
  color: "#FFD84D",
  fontSize: 12,
  lineHeight: 16,
  borderWidth: 2,
  borderRadius: 999,
  padding: 5,
  borderColor: '#FFD84D',
},
avatar: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  statsWrapper: {
  position: "absolute",
  alignSelf: "center",
},
statsPanel: {
  flexDirection: "row",
  alignItems: "center",
  gap: Spacing.three,
  paddingVertical: Spacing.one + 2,
  paddingLeft: Spacing.one + 2,
  paddingRight: Spacing.three,
  borderRadius: 999,
  borderWidth: 1,
},
statsEloBorder: {
  borderWidth: 1,
  borderColor: "#FFD84D",
  borderRadius: 999,
  paddingHorizontal: Spacing.two,
  paddingVertical: Spacing.one,
},
statsEloText: {
  color: "#FFD84D",
},

});

