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
  frameProcessor?: any;
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
  frameProcessor,
}: VisionCameraViewProps) {
  if (remounting) return <View style={styles.camera} />;
  return (
    <Camera
      key={cameraKey}
      ref={cameraRef as unknown as React.RefObject<Camera>}
      style={styles.camera}
      device={device}
      isActive={isActive}
      torch="off"
      video
      fps={cameraFps}
      format={selectedFormat}
      onInitialized={onInitialized}
      onError={(e: any) => {
        // Surface camera errors to logs for diagnosis instead of silent native crashes
        console.error('VisionCamera onError', e?.nativeEvent ?? e);
      }}
      frameProcessor={undefined}
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
