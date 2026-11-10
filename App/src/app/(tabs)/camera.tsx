import { StateView } from '@/components/ui/state-view';
import { useTheme } from '@/hooks/use-theme';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { File } from 'expo-file-system';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { Asset, usePermissions } from 'expo-media-library';
import { useIsFocused } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-screens/experimental';
import { toast } from 'sonner-native';
import { uploadPost, type SquareCrop } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import { getMaxZoomFactor } from '../../../modules/camera-zoom';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const WIDE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera';
const MAX_MAGNIFICATION = 10;
const FALLBACK_MAX_ZOOM_FACTOR = 10;
const MAX_CROP_SCALE = 5;
const FRAME_TOP_GAP = 8;
const SENSOR_ASPECT = 4 / 3;

const FLASH_ORDER: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_ICON: Record<string, SymbolViewProps['name']> = {
  off: { ios: 'bolt.slash.fill', android: 'flash_off', web: 'flash_off' },
  auto: { ios: 'bolt.badge.automatic.fill', android: 'flash_auto', web: 'flash_auto' },
  on: { ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' },
};
const FLASH_LABEL: Record<string, string> = { off: 'Flash off', auto: 'Flash auto', on: 'Flash on' };

type Photo = { uri: string; width: number; height: number };

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [, requestMediaPermission] = usePermissions();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const theme = useTheme();

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted)
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
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

  if (photo) return <CropScreen key={photo.uri} photo={photo} onDone={() => setPhoto(null)} />;
  return <CaptureScreen onCapture={setPhoto} />;
}

function CaptureScreen({ onCapture }: { onCapture: (photo: Photo) => void }) {
  const camera = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [magnification, setMagnification] = useState(1);
  const [maxZoomFactors, setMaxZoomFactors] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const pinchStart = useRef(1);
  const flipTurns = useSharedValue(0);
  const focused = useIsFocused();
  const { width: frameSize } = useWindowDimensions();
  const sensorOverflow = (frameSize * SENSOR_ASPECT - frameSize) / 2;

  const maxZoomFactor = maxZoomFactors[facing];
  const maxMagnification = Math.min(MAX_MAGNIFICATION, maxZoomFactor ?? MAX_MAGNIFICATION);
  const zoom = Math.min(1, Math.max(0, Math.log(magnification) / Math.log(maxZoomFactor ?? FALLBACK_MAX_ZOOM_FACTOR)));

  useEffect(() => {
    if (!ready || Platform.OS !== 'ios' || maxZoomFactors[facing]) return;
    const timer = setTimeout(() => {
      const factor = getMaxZoomFactor(WIDE, facing === 'front' ? 'front' : 'back');
      if (factor && factor > 1) setMaxZoomFactors((current) => ({ ...current, [facing]: factor }));
    }, 300);
    return () => clearTimeout(timer);
  }, [ready, facing, maxZoomFactors]);

  const changeMagnification = (next: number) => {
    setMagnification(Math.min(maxMagnification, Math.max(1, next)));
  };

  const flipCamera = () => {
    setReady(false);
    setMagnification(1);
    flipTurns.value = withTiming(flipTurns.value + 1, { duration: 350 });
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: () => {
      pinchStart.current = magnification;
    },
    onUpdate: (event) => changeMagnification(pinchStart.current * event.scale),
  });
  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: flipCamera,
  });
  const previewGestures = useSimultaneousGestures(pinch, doubleTap);

  const flipIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flipTurns.value * 180}deg` }],
  }));

  const takePhoto = async () => {
    if (!ready || capturing) return;
    setCapturing(true);
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
                  mirror={facing === 'front'}
                  selectedLens={Platform.OS === 'ios' && facing === 'back' ? WIDE : undefined}
                  onCameraReady={() => setReady(true)}
                />
              ) : null}
              <View pointerEvents="none" style={[styles.sensorShade, { top: 0, height: sensorOverflow }]} />
              <View pointerEvents="none" style={[styles.sensorShade, { bottom: 0, height: sensorOverflow }]} />
            </View>
          </GestureDetector>
          <GridOverlay />
        </View>

        <ZoomSlider
          magnification={magnification}
          max={maxMagnification}
          showValue={maxZoomFactor !== undefined}
          onChange={changeMagnification}
        />

        <View style={styles.shutterRow}>
          <RoundButton
            label={FLASH_LABEL[flash]}
            onPress={() => setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])}>
            <SymbolView name={FLASH_ICON[flash]} tintColor={flash === 'off' ? '#FFFFFF' : '#FFD23F'} size={22} />
          </RoundButton>
          <Pressable
            onPress={takePhoto}
            disabled={!ready || capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => [styles.shutterRing, (pressed || capturing) && styles.shutterPressed, !ready && styles.dimmed]}>
            <View style={styles.shutterCore} />
          </Pressable>
          <RoundButton label={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'} onPress={flipCamera}>
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
      </SafeAreaView>
    </View>
  );
}

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
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

function ZoomSlider({ magnification, max, showValue, onChange }: {
  magnification: number;
  max: number;
  showValue: boolean;
  onChange: (magnification: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const span = Math.log(max);
  const position = span > 0 ? Math.min(1, Math.log(magnification) / span) : 0;
  const fromX = (x: number) => (trackWidth > 0 ? Math.exp(Math.min(1, Math.max(0, x / trackWidth)) * span) : magnification);

  const drag = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (event) => onChange(fromX(event.x)),
    onUpdate: (event) => onChange(fromX(event.x)),
  });

  return (
    <View style={styles.zoomRow}>
      <Pressable
        onPress={() => onChange(1)}
        accessibilityRole="button"
        accessibilityLabel="Reset zoom"
        hitSlop={8}
        style={styles.zoomValue}>
        {showValue ? (
          <Text style={styles.zoomValueText}>{formatMagnification(magnification)}×</Text>
        ) : (
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="rgba(255,255,255,0.7)" size={16} />
        )}
      </Pressable>
      <GestureDetector gesture={drag}>
        <View
          style={styles.zoomTrackArea}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Zoom"
          accessibilityValue={{ text: `${formatMagnification(magnification)} times` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onChange(magnification * (e.nativeEvent.actionName === 'increment' ? 1.25 : 0.8))}>
          <View style={styles.zoomTrack} />
          <View style={[styles.zoomFill, { width: position * trackWidth }]} />
          <View style={[styles.zoomThumb, { left: position * trackWidth - 11 }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

function formatMagnification(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function CropScreen({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { width: frameSize } = useWindowDimensions();
  const [size, setSize] = useState({ width: photo.width, height: photo.height });
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

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
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not post your photo.')),
  });

  const pan = usePanGesture({
    enabled: !upload.isPending,
    onUpdate: (event) => {
      'worklet';
      offsetX.value = clampOffset(offsetX.value + event.changeX, shownWidth, scale.value, frameSize);
      offsetY.value = clampOffset(offsetY.value + event.changeY, shownHeight, scale.value, frameSize);
    },
  });
  const pinch = usePinchGesture({
    enabled: !upload.isPending,
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

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }],
  }));

  const retake = () => {
    try {
      new File(photo.uri).delete();
    } catch {}
    onDone();
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
    <View style={styles.screen}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.column}>
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
              <View pointerEvents="none" style={styles.cropBorder}>
                <GridOverlay />
              </View>
            </View>
          </GestureDetector>
        </View>

        <View style={styles.controls}>
          <Text style={styles.cropHint}>Drag and pinch to frame your photo</Text>
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
        </View>
      </SafeAreaView>
    </View>
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
  frame: {
    marginTop: FRAME_TOP_GAP,
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
    backgroundColor: '#000000',
  },
  controls: {
    flex: 1,
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
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  zoomValue: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  zoomValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  zoomTrackArea: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  zoomTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  zoomFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  zoomThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  shutterPressed: {
    transform: [{ scale: 0.92 }],
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.28)',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  cropHint: {
    color: 'rgba(255,255,255,0.65)',
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
