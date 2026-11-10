import { StateView } from '@/components/ui/state-view';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { toast } from 'sonner-native';
import { uploadPost } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import { useTheme } from '@/hooks/use-theme';

import { Asset, usePermissions } from 'expo-media-library';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export default function TabTwoScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [, requestMediaPermission] = usePermissions();
  const camera = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const theme = useTheme();

  const upload = useMutation({
    mutationFn: async (photoUri: string) => {
      await uploadPost(photoUri);
      await Asset.create(photoUri).catch(() => {});
    },
    onSuccess: () => {
      toast.success('Photo uploaded');
      setUri(null);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not upload your photo.')),
  });

  if (!permission) return <View style={{ flex: 1, backgroundColor: theme.background}} />;
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
    try {
      const photo = await camera.current?.takePictureAsync({ exif: true });
      if (photo) setUri(photo.uri);
    } catch {
      toast.error('Could not take the photo. Try again.');
    }
  };

  const retake = () => {
    try {
      if (uri) new File(uri).delete();
    } catch {}
    setUri(null);
  };

  const submitFoto = () => {
    if (uri && !upload.isPending) upload.mutate(uri);
  };

  if (uri)
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" />
        <SafeAreaView edges={{ bottom: true }} pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.controls}>
          <Pressable onPress={retake} disabled={upload.isPending} style={{ paddingVertical: 16, paddingHorizontal: 32, backgroundColor: "#fff", borderRadius: 8, opacity: upload.isPending ? 0.5 : 1 }}>
            <Text style={{ fontSize: 18 }}>Retake</Text>
          </Pressable>
          <Pressable onPress={submitFoto} disabled={upload.isPending} style={{ minWidth: 120, alignItems: "center", paddingVertical: 16, paddingHorizontal: 32, backgroundColor: "#fff", borderRadius: 8 }}>
            {upload.isPending ? <ActivityIndicator color="#111111" /> : <Text style={{ fontSize: 18 }}>Submit</Text>}
          </Pressable>
        </View>
        </SafeAreaView>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
      <SafeAreaView edges={{ bottom: true }} pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.controls}>
        <Pressable onPress={takePhoto}>
          {useGlass ? (
            <GlassView style={styles.shutter} glassEffectStyle="regular" isInteractive tintColor="rgba(255,255,255,0.25)">
              <View style={styles.inner} />
            </GlassView>
          ) : (
            <BlurView intensity={40} tint="light" style={styles.shutter}>
              <View style={styles.inner} />
            </BlurView>
          )}
        </Pressable>
      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  controls: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  inner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});