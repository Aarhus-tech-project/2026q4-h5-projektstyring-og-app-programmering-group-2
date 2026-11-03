import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Button, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/api';

import * as MediaLibrary from 'expo-media-library/legacy';

const useGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export default function TabTwoScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [, requestMediaPermission] = MediaLibrary.usePermissions();
  const camera = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);

  if (!permission) return null;
  if (!permission.granted)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Button title="Allow camera"
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings(), requestMediaPermission())}
          />
      </View>
    );

  const takePhoto = async () => {
    const photo = await camera.current?.takePictureAsync();
    if (photo) setUri(photo.uri);
  };

  const retake = () => {
    new File(uri!).delete();
    setUri(null);
  };

  const submitFoto = async () => {
    const file = new File(uri!);
    await MediaLibrary.saveToLibraryAsync(file.uri);

    const form = new FormData();
    form.append('File', file);

    const { response } = await api.POST('/api/Posts', {
      body: form as unknown as { File?: string },
    });

    setUri(null);
  };

  if (uri)
    return (
      <View style={{ flex: 1 }}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" />
        <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "space-evenly" }}>
          <Pressable onPress={retake} style={{ paddingVertical: 16, paddingHorizontal: 32, backgroundColor: "#fff", borderRadius: 8 }}>
            <Text style={{ fontSize: 18 }}>Retake</Text>
          </Pressable>
          <Pressable onPress={submitFoto} style={{ paddingVertical: 16, paddingHorizontal: 32, backgroundColor: "#fff", borderRadius: 8 }}>
            <Text style={{ fontSize: 18 }}>Submit</Text>
          </Pressable>
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
      <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "space-evenly" }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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