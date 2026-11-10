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
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-screens/experimental';
import { toast } from 'sonner-native';
import { uploadPost } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

const ULTRA_WIDE = 'AVCaptureDeviceTypeBuiltInUltraWideCamera';
const WIDE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera';
const PINCH_SENSITIVITY = 0.35;

const FLASH_ORDER: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_ICON: Record<string, SymbolViewProps['name']> = {
  off: { ios: 'bolt.slash.fill', android: 'flash_off', web: 'flash_off' },
  auto: { ios: 'bolt.badge.automatic.fill', android: 'flash_auto', web: 'flash_auto' },
  on: { ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' },
};
const FLASH_LABEL: Record<string, string> = { off: 'Flash off', auto: 'Flash auto', on: 'Flash on' };

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [, requestMediaPermission] = usePermissions();
  const camera = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [lens, setLens] = useState<string>(WIDE);
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const pinchStartZoom = useRef(0);
  const queryClient = useQueryClient();
  const theme = useTheme();
  const focused = useIsFocused();

  const upload = useMutation({
    mutationFn: async (photoUri: string) => {
      await uploadPost(photoUri);
      await Asset.create(photoUri).catch(() => {});
    },
    onSuccess: () => {
      toast.success('Photo posted');
      setUri(null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not post your photo.')),
  });

  const flipCamera = () => {
    setReady(false);
    setZoom(0);
    setLens(WIDE);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: () => {
      pinchStartZoom.current = zoom;
    },
    onUpdate: (event) => {
      const next = pinchStartZoom.current + (event.scale - 1) * PINCH_SENSITIVITY;
      setZoom(Math.min(1, Math.max(0, next)));
    },
  });
  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: flipCamera,
  });
  const previewGestures = useSimultaneousGestures(pinch, doubleTap);

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

  const takePhoto = async () => {
    if (!ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current?.takePictureAsync({ exif: true });
      if (photo) setUri(photo.uri);
    } catch {
      toast.error('Could not take the photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    try {
      if (uri) new File(uri).delete();
    } catch {}
    setUri(null);
  };

  const post = () => {
    if (uri && !upload.isPending) upload.mutate(uri);
  };

  const selectLens = (next: string) => {
    setZoom(0);
    setLens(next);
  };

  if (uri)
    return (
      <View style={styles.screen}>
        <Image source={{ uri }} style={[styles.fill, upload.isPending && styles.dimmed]} contentFit="contain" />
        <SafeAreaView edges={{ bottom: true }} pointerEvents="box-none" style={styles.overlay}>
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
        </SafeAreaView>
      </View>
    );

  const showLensChips = facing === 'back';
  const onWide = lens === WIDE && zoom === 0;

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={previewGestures}>
        <View style={styles.fill}>
          {focused ? (
            <CameraView
              ref={camera}
              style={styles.fill}
              facing={facing}
              flash={flash}
              zoom={zoom}
              mirror={facing === 'front'}
              selectedLens={Platform.OS === 'ios' && facing === 'back' ? lens : undefined}
              onCameraReady={() => setReady(true)}
              onAvailableLensesChanged={({ lenses }) => setHasUltraWide(lenses.some((l) => l.deviceType === ULTRA_WIDE))}
            />
          ) : (
            <View style={styles.fill} />
          )}
          {grid && <GridOverlay />}
        </View>
      </GestureDetector>

      <SafeAreaView edges={{ top: true }} pointerEvents="box-none" style={styles.topOverlay}>
        <View style={styles.topBar}>
          <ControlButton
            icon={FLASH_ICON[flash]}
            label={FLASH_LABEL[flash]}
            active={flash !== 'off'}
            onPress={() => setFlash(FLASH_ORDER[(FLASH_ORDER.indexOf(flash) + 1) % FLASH_ORDER.length])}
          />
          <ControlButton
            icon={{ ios: 'squareshape.split.3x3', android: grid ? 'grid_on' : 'grid_off', web: 'grid_on' }}
            label={grid ? 'Hide grid' : 'Show grid'}
            active={grid}
            onPress={() => setGrid((g) => !g)}
          />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={{ bottom: true }} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.bottom}>
          {showLensChips && (
            <View style={styles.lensRow}>
              {hasUltraWide && (
                <LensChip label=".5" selected={lens === ULTRA_WIDE} onPress={() => selectLens(ULTRA_WIDE)} />
              )}
              <LensChip label={onWide || lens === ULTRA_WIDE ? '1×' : 'Reset'} selected={onWide} onPress={() => selectLens(WIDE)} />
            </View>
          )}
          <View style={styles.shutterRow}>
            <View style={styles.sideSlot} />
            <Pressable
              onPress={takePhoto}
              disabled={!ready || capturing}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => [styles.shutterRing, (pressed || capturing) && styles.shutterPressed, !ready && styles.dimmed]}>
              <View style={styles.shutterCore} />
            </Pressable>
            <View style={styles.sideSlot}>
              <ControlButton
                icon={{ ios: 'arrow.triangle.2.circlepath.camera', android: 'cameraswitch', web: 'cameraswitch' }}
                label={facing === 'back' ? 'Switch to front camera' : 'Switch to back camera'}
                size={52}
                onPress={flipCamera}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Chrome({ style }: { style?: object }) {
  return useGlass ? (
    <GlassView style={style} glassEffectStyle="regular" tintColor="rgba(0,0,0,0.25)" />
  ) : (
    <BlurView style={style} intensity={40} tint="dark" />
  );
}

function ControlButton({ icon, label, onPress, active, size = 44 }: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.control, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressed]}>
      <Chrome style={StyleSheet.absoluteFill} />
      <SymbolView name={icon} tintColor={active ? '#FFD23F' : '#FFFFFF'} size={size * 0.42} />
    </Pressable>
  );
}

function LensChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {!selected && <Chrome style={StyleSheet.absoluteFill} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
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
  fill: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flex: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bottom: {
    gap: 18,
    marginBottom: 20,
  },
  lensRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  sideSlot: {
    width: 52,
    alignItems: 'center',
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
  control: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chipTextSelected: {
    color: '#FFD23F',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  reviewBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
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
