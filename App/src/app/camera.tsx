import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Button, Linking, View } from 'react-native';
import { api } from '../../lib/api';

import * as MediaLibrary from 'expo-media-library/legacy';

export default function TabTwoScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);

  if (!permission) return null;
  if (!permission.granted)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Button title="Allow camera"
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings(), MediaLibrary.usePermissions())}
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
        <Button title="Retake" onPress={retake} />
        <Button title="Submit" onPress={submitFoto} />
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
      <Button title="Take photo" onPress={takePhoto} />
    </View>
  );
}