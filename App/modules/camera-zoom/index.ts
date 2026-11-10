import { requireOptionalNativeModule } from 'expo-modules-core';

type CameraZoomModule = {
  getMaxZoomFactor(deviceType: string, position: 'front' | 'back'): number | null;
};

const native = requireOptionalNativeModule<CameraZoomModule>('CameraZoom');

export function getMaxZoomFactor(deviceType: string, position: 'front' | 'back') {
  try {
    return native?.getMaxZoomFactor(deviceType, position) ?? null;
  } catch {
    return null;
  }
}
