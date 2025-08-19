import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';

export type VisionCameraViewProps = {
  remounting: boolean;
  cameraKey: string;
  cameraRef: React.RefObject<Camera | null>;
  device: CameraDevice;
  isActive: boolean;
  cameraFps: number | undefined;
  selectedFormat: CameraDeviceFormat | undefined;
  onInitialized: () => void;
};

export default function VisionCameraView({
  remounting,
  cameraKey,
  cameraRef,
  device,
  isActive,
  cameraFps,
  selectedFormat,
  onInitialized,
}: VisionCameraViewProps) {
  if (remounting) return <View style={styles.camera} />;
  return (
    <Camera
      key={cameraKey}
      ref={cameraRef as unknown as React.RefObject<Camera>}
      style={styles.camera}
      device={device}
      isActive={isActive}
      torch="on"
      video
      fps={cameraFps}
      format={selectedFormat}
      onInitialized={onInitialized}
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
