import React, { useEffect } from 'react';
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
  torch?: 'on' | 'off';
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
  torch = 'off',
}: VisionCameraViewProps) {
  // Log key props to help diagnose initialization issues
  useEffect(() => {
    const fmt = selectedFormat
      ? {
          width: selectedFormat.videoWidth,
          height: selectedFormat.videoHeight,
          minFps: selectedFormat.minFps,
          maxFps: selectedFormat.maxFps,
        }
      : null;
    console.log('VisionCameraView props', {
      cameraKey,
      fps: cameraFps,
      format: fmt,
      torch,
      isActive,
      deviceId: device?.id,
      position: device?.position,
    });
  }, [cameraKey, cameraFps, selectedFormat, torch, isActive, device]);

  const handleInitialized = () => {
    console.log('VisionCameraView onInitialized fired');
    onInitialized();
  };

  if (remounting) return <View style={styles.camera} />;
  return (
    <Camera
      key={cameraKey}
      ref={cameraRef as unknown as React.RefObject<Camera>}
      style={styles.camera}
      device={device}
      isActive={isActive}
      torch={torch}
      fps={cameraFps}
      format={selectedFormat}
      onInitialized={handleInitialized}
      onError={(e: any) => {
        // Surface camera errors to logs for diagnosis instead of silent native crashes
        console.error('VisionCamera onError', e?.nativeEvent ?? e);
      }}
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
