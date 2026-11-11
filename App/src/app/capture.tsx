import { StateView } from '@/components/ui/state-view';
import { Button as NativeButton, Host, HStack, Image as NativeImage, Slider, Text as NativeText, type ButtonProps } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as nativeDisabled,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { File } from 'expo-file-system';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { Asset, usePermissions } from 'expo-media-library';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useExclusiveGestures,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  FadeIn,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-screens/experimental';
import { Fonts } from '@/constants/theme';
import { toast } from 'sonner-native';
import { uploadPost, type SquareCrop } from '../../lib/api';
import { errorMessage } from '../../lib/errors';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const WIDE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera';
const MAX_ZOOM = 0.5;
const ZOOM_PER_PINCH_DOUBLING = 0.12;
const MAX_CROP_SCALE = 5;
const SENSOR_ASPECT = 4 / 3;
const BELOW_FRAME_MIN = 160;
const PRESS_SPRING = { damping: 14, stiffness: 320 };

const FLASH_ORDER: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_ICON: Record<string, SymbolViewProps['name']> = {
  off: { ios: 'bolt.slash.fill', android: 'flash_off', web: 'flash_off' },
  auto: { ios: 'bolt.badge.automatic.fill', android: 'flash_auto', web: 'flash_auto' },
  on: { ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' },
};
const FLASH_LABEL: Record<string, string> = { off: 'Flash off', auto: 'Flash auto', on: 'Flash on' };
const FLASH_SYMBOL: Record<string, NonNullable<ButtonProps['systemImage']>> = {
  off: 'bolt.slash.fill',
  auto: 'bolt.badge.automatic.fill',
  on: 'bolt.fill',
};

const native = Platform.OS === 'ios';
const glassStyle = useGlass ? 'glass' : 'bordered';
const prominentStyle = useGlass ? 'glassProminent' : 'borderedProminent';
const BRAND_GOLD = '#FFD23F';

type Photo = { uri: string; width: number; height: number };

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [, requestMediaPermission] = usePermissions();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted)
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <SafeAreaView edges={{ top: true }} style={styles.closeArea}>
          <CloseButton tint={theme.text} scheme={scheme} />
        </SafeAreaView>
        <StateView
          icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
          title="Camera access needed"
          message={permission.canAskAgain
            ? 'Fotolo needs your camera to take photos for voting.'
            : 'Camera access is turned off. Turn it on in Settings to take photos.'}
          actionLabel={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          onAction={() => {
            if (permission.canAskAgain) requestPermission();
            else Linking.openSettings();
            requestMediaPermission();
          }}
        />
      </View>
    );

  return (
    <>
      <StatusBar style="light" />
      {photo ? (
        <CropScreen key={photo.uri} photo={photo} onRetake={() => setPhoto(null)} onPosted={() => router.back()} />
      ) : (
        <CaptureScreen onCapture={setPhoto} />
      )}
    </>
  );
}

function CaptureScreen({ onCapture }: { onCapture: (photo: Photo) => void }) {
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const pinchStart = useRef(0);
  const flipTurns = useSharedValue(0);
  const blink = useSharedValue(0);
  const focused = useIsFocused();
  const { width: frameSize } = useWindowDimensions();
  const sensorOverflow = (frameSize * SENSOR_ASPECT - frameSize) / 2;

  const changeZoom = (next: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(0, next)));
  };

  const flipCamera = () => {
    setZoom(0);
    flipTurns.value = withTiming(flipTurns.value + 1, { duration: 350 });
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: () => {
      pinchStart.current = zoom;
    },
    onUpdate: (event) => changeZoom(pinchStart.current + Math.log2(event.scale) * ZOOM_PER_PINCH_DOUBLING),
  });
  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    maxDistance: 12,
    onActivate: flipCamera,
  });
  const previewGestures = useExclusiveGestures(pinch, doubleTap);

  const flipIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flipTurns.value * 180}deg` }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const takePhoto = async () => {
    if (!ready || capturing) return;
    setCapturing(true);
    blink.set(withSequence(withTiming(0.9, { duration: 50 }), withTiming(0, { duration: 260 })));
    try {
      const shot = await camera.current?.takePictureAsync({ exif: true });
      if (shot) onCapture({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch {
      toast.error('Could not take the photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.column}>
        <View style={[styles.aboveFrame, { minHeight: sensorOverflow }]}>
          <View style={styles.closeRow}>
            <CloseButton glass />
          </View>
        </View>
        <View style={[styles.frame, { width: frameSize, height: frameSize }]}>
          <GestureDetector gesture={previewGestures}>
            <View style={[styles.sensor, { top: -sensorOverflow, height: frameSize + sensorOverflow * 2 }]}>
              {focused ? (
                <CameraView
                  ref={camera}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  flash={flash}
                  zoom={zoom}
                  animateShutter={false}
                  mirror={facing === 'front'}
                  selectedLens={Platform.OS === 'ios' && facing === 'back' ? WIDE : undefined}
                  onCameraReady={() => setReady(true)}
                />
              ) : null}
              <View pointerEvents="none" style={[styles.sensorShade, { top: 0, height: sensorOverflow }]} />
              <View pointerEvents="none" style={[styles.sensorShade, { bottom: 0, height: sensorOverflow }]} />
            </View>
          </GestureDetector>
          {grid && <GridOverlay />}
          <View pointerEvents="none" style={styles.frameEdge} />
          <Animated.View pointerEvents="none" style={[styles.blink, blinkStyle]} />
        </View>

        <View style={[styles.belowFrame, { paddingTop: sensorOverflow, minHeight: BELOW_FRAME_MIN + sensorOverflow }]}>
          <ZoomSlider
            zoom={zoom}
            onChange={changeZoom}
            grid={grid}
            onToggleGrid={() => setGrid((g) => !g)}
          />

          <View style={styles.shutterRow}>
            <RoundButton
              label={FLASH_LABEL[flash]}
              systemImage={FLASH_SYMBOL[flash]}
              active={flash !== 'off'}
              onPress={() => setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])}>
              <SymbolView name={FLASH_ICON[flash]} tintColor={flash === 'off' ? '#FFFFFF' : '#FFD23F'} size={22} />
            </RoundButton>
            <ShutterButton disabled={!ready || capturing} onPress={takePhoto} />
            <RoundButton
              label={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'}
              systemImage="arrow.triangle.2.circlepath"
              onPress={flipCamera}>
              <Animated.View style={flipIconStyle}>
                <SymbolView
                  name={{ ios: 'arrow.triangle.2.circlepath', android: 'flip_camera_android', web: 'flip_camera_android' }}
                  tintColor="#FFFFFF"
                  size={22}
                  weight="semibold"
                />
              </Animated.View>
            </RoundButton>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ShutterButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const press = useSharedValue(1);
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        press.set(withSpring(0.86, PRESS_SPRING));
      }}
      onPressOut={() => {
        press.set(withSpring(1, PRESS_SPRING));
      }}
      accessibilityRole="button"
      accessibilityLabel="Take photo"
      style={[styles.shutterRing, disabled && styles.dimmed]}>
      <Animated.View style={[styles.shutterCore, coreStyle]} />
    </Pressable>
  );
}

function CloseButton({ glass, tint: color = '#FFFFFF', scheme = 'dark' }: { glass?: boolean; tint?: string; scheme?: 'light' | 'dark' }) {
  if (native)
    return (
      <Host matchContents colorScheme={scheme} style={styles.nativeHost}>
        <NativeButton
          label="Close camera"
          systemImage="xmark"
          onPress={() => router.back()}
          modifiers={[buttonStyle(glassStyle), controlSize('large'), labelStyle('iconOnly')]}
        />
      </Host>
    );
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close camera"
      hitSlop={10}
      style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
      {glass && <Chrome style={StyleSheet.absoluteFill} />}
      <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={color} size={16} weight="semibold" />
    </Pressable>
  );
}

function RoundButton({ label, systemImage, active, onPress, children }: {
  label: string;
  systemImage: NonNullable<ButtonProps['systemImage']>;
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  if (native)
    return (
      <Host matchContents colorScheme="dark" style={styles.nativeHost}>
        <NativeButton
          label={label}
          systemImage={systemImage}
          onPress={onPress}
          modifiers={[
            buttonStyle(glassStyle),
            controlSize('extraLarge'),
            labelStyle('iconOnly'),
            foregroundStyle(active ? BRAND_GOLD : '#FFFFFF'),
          ]}
        />
      </Host>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <Chrome style={StyleSheet.absoluteFill} />
      {children}
    </Pressable>
  );
}

function ZoomSlider({ zoom, onChange, grid, onToggleGrid }: {
  zoom: number;
  onChange: (zoom: number) => void;
  grid: boolean;
  onToggleGrid: () => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const position = zoom / MAX_ZOOM;
  const fromX = (x: number) => (trackWidth > 0 ? Math.min(1, Math.max(0, x / trackWidth)) * MAX_ZOOM : zoom);
  const zoomed = zoom > 0;

  const drag = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (event) => onChange(fromX(event.x)),
    onUpdate: (event) => onChange(fromX(event.x)),
  });

  if (native)
    return (
      <View style={styles.zoomRow}>
        <Host matchContents={{ vertical: true }} colorScheme="dark" style={styles.zoomHost}>
          <HStack spacing={14}>
            <NativeButton
              label="1×"
              onPress={() => onChange(0)}
              modifiers={[buttonStyle(glassStyle), nativeDisabled(!zoomed), accessibilityLabel('Reset zoom to 1×')]}
            />
            <Slider
              value={zoom}
              min={0}
              max={MAX_ZOOM}
              onValueChange={onChange}
              modifiers={[tint('#FFFFFF'), accessibilityLabel('Zoom')]}
            />
            <NativeButton
              label={grid ? 'Hide grid' : 'Show grid'}
              systemImage="grid"
              onPress={onToggleGrid}
              modifiers={[buttonStyle(glassStyle), labelStyle('iconOnly'), foregroundStyle(grid ? BRAND_GOLD : '#FFFFFF')]}
            />
          </HStack>
        </Host>
      </View>
    );

  return (
    <View style={styles.zoomRow}>
      <Pressable
        onPress={() => onChange(0)}
        disabled={!zoomed}
        accessibilityRole="button"
        accessibilityLabel="Reset zoom to 1×"
        hitSlop={8}
        style={({ pressed }) => [styles.zoomChip, pressed && styles.pressed]}>
        <Chrome style={StyleSheet.absoluteFill} />
        <Text style={[styles.zoomValueText, !zoomed && styles.zoomValueIdle]}>1×</Text>
      </Pressable>
      <GestureDetector gesture={drag}>
        <View
          style={styles.zoomTrackArea}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Zoom"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(position * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onChange(zoom + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))}>
          <View style={styles.zoomTrack} />
          <View style={[styles.zoomFill, { width: position * trackWidth }]} />
          <View style={[styles.zoomThumb, { left: position * trackWidth - 12 }]} />
        </View>
      </GestureDetector>
      <Pressable
        onPress={onToggleGrid}
        accessibilityRole="switch"
        accessibilityLabel="Grid"
        accessibilityState={{ checked: grid }}
        hitSlop={8}
        style={({ pressed }) => [styles.zoomChip, grid && styles.chipOn, pressed && styles.pressed]}>
        {!grid && <Chrome style={StyleSheet.absoluteFill} />}
        <SymbolView name={{ ios: 'grid', android: 'grid_on', web: 'grid_on' }} tintColor={grid ? '#111111' : 'rgba(255,255,255,0.8)'} size={16} />
      </Pressable>
    </View>
  );
}

function CropScreen({ photo, onRetake, onPosted }: { photo: Photo; onRetake: () => void; onPosted: () => void }) {
  const queryClient = useQueryClient();
  const { width: frameSize } = useWindowDimensions();
  const sensorOverflow = (frameSize * SENSOR_ASPECT - frameSize) / 2;
  const [size, setSize] = useState({ width: photo.width, height: photo.height });
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const guides = useSharedValue(0);

  const base = frameSize / Math.min(size.width, size.height);
  const shownWidth = size.width * base;
  const shownHeight = size.height * base;

  const upload = useMutation({
    mutationFn: async (crop: SquareCrop) => {
      await uploadPost(photo.uri, crop);
      await Asset.create(photo.uri).catch(() => {});
    },
    onSuccess: () => {
      toast.success('Photo posted');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onPosted();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not post your photo.')),
  });

  const showGuides = () => {
    'worklet';
    guides.value = withTiming(1, { duration: 120 });
  };
  const hideGuides = () => {
    'worklet';
    guides.value = withTiming(0, { duration: 350 });
  };

  const pan = usePanGesture({
    enabled: !upload.isPending,
    onBegin: showGuides,
    onFinalize: hideGuides,
    onUpdate: (event) => {
      'worklet';
      offsetX.value = clampOffset(offsetX.value + event.changeX, shownWidth, scale.value, frameSize);
      offsetY.value = clampOffset(offsetY.value + event.changeY, shownHeight, scale.value, frameSize);
    },
  });
  const pinch = usePinchGesture({
    enabled: !upload.isPending,
    onBegin: showGuides,
    onFinalize: hideGuides,
    onUpdate: (event) => {
      'worklet';
      const next = Math.min(MAX_CROP_SCALE, Math.max(1, scale.value * event.scaleChange));
      const ratio = next / scale.value;
      const focalX = event.focalX - frameSize / 2;
      const focalY = event.focalY - frameSize / 2;
      scale.value = next;
      offsetX.value = clampOffset(focalX + (offsetX.value - focalX) * ratio, shownWidth, next, frameSize);
      offsetY.value = clampOffset(focalY + (offsetY.value - focalY) * ratio, shownHeight, next, frameSize);
    },
  });
  const doubleTap = useTapGesture({
    enabled: !upload.isPending,
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      scale.value = withTiming(1);
      offsetX.value = withTiming(0);
      offsetY.value = withTiming(0);
    },
  });
  const gestures = useSimultaneousGestures(pan, pinch, doubleTap);

  const guidesStyle = useAnimatedStyle(() => ({ opacity: guides.value }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }],
  }));

  const retake = () => {
    try {
      new File(photo.uri).delete();
    } catch {}
    onRetake();
  };

  const post = () => {
    if (upload.isPending) return;
    const s = scale.value;
    const side = Math.min(size.width, size.height) / s;
    const centerX = size.width / 2 - offsetX.value / (base * s);
    const centerY = size.height / 2 - offsetY.value / (base * s);
    upload.mutate({
      x: clamp01((centerX - side / 2) / size.width),
      y: clamp01((centerY - side / 2) / size.height),
      size: clamp01(1 / s),
    });
  };

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.screen}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.column}>
        <View style={[styles.aboveFrame, { minHeight: sensorOverflow }]} />
        <View style={[styles.frame, { width: frameSize, height: frameSize }]}>
          <GestureDetector gesture={gestures}>
            <View style={StyleSheet.absoluteFill}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: (frameSize - shownWidth) / 2,
                    top: (frameSize - shownHeight) / 2,
                    width: shownWidth,
                    height: shownHeight,
                  },
                  imageStyle,
                ]}>
                <Image
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="fill"
                  onLoad={(e) => setSize({ width: e.source.width, height: e.source.height })}
                />
              </Animated.View>
              <View pointerEvents="none" style={[styles.cropShade, { bottom: frameSize }]} />
              <View pointerEvents="none" style={[styles.cropShade, { top: frameSize }]} />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, guidesStyle]}>
                <GridOverlay />
              </Animated.View>
              <View pointerEvents="none" style={styles.cropBorder} />
            </View>
          </GestureDetector>
        </View>

        <View style={[styles.controls, { paddingTop: sensorOverflow, minHeight: BELOW_FRAME_MIN + sensorOverflow }]}>
          <View style={styles.cropHint}>
            <SymbolView name={{ ios: 'hand.draw', android: 'pan_tool', web: 'pan_tool' }} tintColor="rgba(255,255,255,0.55)" size={15} />
            <Text style={styles.cropHintText}>Drag and pinch to frame your photo</Text>
          </View>
          {native ? (
            <Host matchContents={{ vertical: true }} colorScheme="dark" style={styles.reviewHost}>
              <HStack spacing={12}>
                <NativeButton
                  onPress={retake}
                  modifiers={[buttonStyle(glassStyle), controlSize('extraLarge'), nativeDisabled(upload.isPending)]}>
                  <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
                    <NativeImage systemName="arrow.counterclockwise" />
                    <NativeText modifiers={[font({ weight: 'semibold' })]}>Retake</NativeText>
                  </HStack>
                </NativeButton>
                <NativeButton
                  onPress={post}
                  modifiers={[
                    buttonStyle(prominentStyle),
                    tint(BRAND_GOLD),
                    foregroundStyle('#111111'),
                    controlSize('extraLarge'),
                    nativeDisabled(upload.isPending),
                  ]}>
                  <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
                    <NativeImage systemName={upload.isPending ? 'hourglass' : 'arrow.up'} />
                    <NativeText modifiers={[font({ weight: 'bold' })]}>{upload.isPending ? 'Posting…' : 'Post photo'}</NativeText>
                  </HStack>
                </NativeButton>
              </HStack>
            </Host>
          ) : (
          <View style={styles.reviewBar}>
            <Pressable
              onPress={retake}
              disabled={upload.isPending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reviewButton, styles.retakeButton, (pressed || upload.isPending) && styles.pressed]}>
              <Chrome style={StyleSheet.absoluteFill} />
              <SymbolView name={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }} tintColor="#FFFFFF" size={18} />
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
            <Pressable
              onPress={post}
              disabled={upload.isPending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reviewButton, styles.postButton, pressed && styles.pressed]}>
              {upload.isPending ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor="#111111" size={18} weight="bold" />
              )}
              <Text style={styles.postText}>{upload.isPending ? 'Posting…' : 'Post photo'}</Text>
            </Pressable>
          </View>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function clampOffset(offset: number, shown: number, scale: number, frame: number) {
  'worklet';
  const limit = Math.max(0, (shown * scale - frame) / 2);
  return Math.min(limit, Math.max(-limit, offset));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function Chrome({ style }: { style?: object }) {
  return useGlass ? (
    <GlassView style={style} glassEffectStyle="regular" tintColor="rgba(0,0,0,0.25)" />
  ) : (
    <BlurView style={style} intensity={40} tint="dark" />
  );
}

function GridOverlay() {
  const lines: ReactNode[] = [];
  for (const pos of ['33.333%', '66.666%'] as const) {
    lines.push(<View key={`v${pos}`} style={[styles.gridLine, { left: pos, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />);
    lines.push(<View key={`h${pos}`} style={[styles.gridLine, { top: pos, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />);
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{lines}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  column: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  aboveFrame: {
    flexGrow: 1,
    flexBasis: 0,
    zIndex: 1,
  },
  closeRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  closeArea: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    flexShrink: 0,
  },
  belowFrame: {
    flexGrow: 1,
    flexBasis: 0,
  },
  sensor: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: '#0A0A0A',
  },
  sensorShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controls: {
    flexGrow: 1,
    flexBasis: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 8,
  },
  shutterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  nativeHost: {
    alignSelf: 'center',
  },
  zoomHost: {
    flex: 1,
  },
  reviewHost: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  zoomChip: {
    width: 48,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: '#FFFFFF',
  },
  zoomValueIdle: {
    opacity: 0.55,
  },
  zoomValueText: {
    color: '#FFFFFF',
    fontFamily: Fonts?.rounded,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  zoomTrackArea: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  zoomTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  zoomFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  zoomThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },
  blink: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
  },
  frameEdge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  cropShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2000,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  cropBorder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cropHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cropHintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  reviewBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  reviewButton: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  retakeButton: {
    flex: 1,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  postButton: {
    flex: 1.6,
    backgroundColor: '#FFFFFF',
  },
  postText: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '700',
  },
});
