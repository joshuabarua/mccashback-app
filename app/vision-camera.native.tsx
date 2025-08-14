import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera } from 'react-native-vision-camera';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import BackButton from '../components/BackButton';
import ControlsOverlay from '../components/ControlsOverlay';
import FocusOverlay from '../components/FocusOverlay';
import ToastOverlay from '../components/Toast';
import VisionCameraView from '../components/VisionCameraView';
import { useFormatsAndFps } from '../hooks/useFormatsAndFps';
import { useFpsCycler } from '../hooks/useFpsCycler';
import { useReconfiguration } from '../hooks/useReconfiguration';
import { useRecording } from '../hooks/useRecording';
 

interface Point {
  x: number;
  y: number;
}

export default function VisionCameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();
  
  // Camera states
  const [isActive, setIsActive] = useState(true);
  const [fps, setFps] = useState(30);
  const [focusPoint, setFocusPoint] = useState<Point | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const pendingResumeRef = useRef(false);
  const pendingFpsRef = useRef<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraReadyRef = useRef(false);
  const prevFpsRef = useRef(fps);
  const [remounting, setRemounting] = useState(false);

  // Toast helper (defined before usage)
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 1500);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);
  
  
  // Formats and FPS selections (extracted hook)
  const { selectedFormat, effectiveFps, cameraFps, supportedFpsOptions } = useFormatsAndFps(device, fps, setFps);

  // Camera key: include fps only when we actually pass it
  const cameraKey = useMemo(() => {
    const base = `${selectedFormat?.videoWidth}x${selectedFormat?.videoHeight}-${selectedFormat?.minFps}-${selectedFormat?.maxFps}`;
    const fpsPart = cameraFps == null ? 'auto' : String(cameraFps);
    return `${base}-${fpsPart}`;
  }, [selectedFormat, cameraFps]);

  

  // Handle configuring state and iOS remounts (extracted)
  useReconfiguration({
    device,
    fps,
    selectedFormat,
    prevFpsRef,
    setIsConfiguring,
    setRemounting,
    setIsActive,
    cameraReadyRef,
  });

  

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Manual focus function
  const focus = useCallback((point: Point) => {
    const camera = cameraRef.current;
    if (camera == null) return;
    
    try {
      camera.focus(point);
      setFocusPoint(point);
      
      // Clear focus point after 2 seconds
      setTimeout(() => {
        setFocusPoint(null);
      }, 2000);
    } catch (error) {
      console.log('Focus failed:', error);
    }
  }, []);

  // Tap gesture for manual focus
  const tapGesture = Gesture.Tap()
    .onEnd(({ x, y }) => {
      runOnJS(focus)({ x, y });
    });

  // removed strobe/flash feature

  const handleBack = () => {
    setIsActive(false);
    router.back();
  };

  // Recording logic (extracted)
  const { isRecording, startRecording, stopRecording } = useRecording({
    cameraRef,
    isActive,
    isConfiguring,
    showToast,
    pendingResumeRef,
    pendingFpsRef,
    setFps,
    cameraFps,
    fps,
    cameraReadyRef,
  });

  // Wire the real isRecording back into the cycler hook via closure update
  // Note: our cycler hook reads "isRecording" from its closure. Recreate handler when this changes.
  const { cycleFps } = useFpsCycler({
    supportedFpsOptions,
    fps,
    setFps,
    isRecording,
    showToast,
    pendingFpsRef,
    prevFpsRef,
  });

  // Debug: log selected format on change
  useEffect(() => {
    if (!selectedFormat) return;
    console.log('Selected format change:', {
      w: selectedFormat.videoWidth,
      h: selectedFormat.videoHeight,
      min: selectedFormat.minFps,
      max: selectedFormat.maxFps,
      targetFps: fps,
      cameraFps,
    });
  }, [selectedFormat, fps, cameraFps]);

  

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={tapGesture}>
        <VisionCameraView
          remounting={remounting}
          cameraKey={cameraKey}
          cameraRef={cameraRef}
          device={device!}
          isActive={isActive}
          cameraFps={cameraFps}
          selectedFormat={selectedFormat}
          onInitialized={() => { cameraReadyRef.current = true; }}
        />
      </GestureDetector>

      {/* Toast */}
      {toast && <ToastOverlay message={toast} bottom={140 + insets.bottom} />}

      {/* Focus indicator */}
      <FocusOverlay point={focusPoint} />

      {/* Back button */}
      <BackButton onPress={handleBack} />

      {/* Control overlay */}
      <ControlsOverlay
        insetsBottom={insets.bottom}
        isRecording={isRecording}
        isConfiguring={isConfiguring}
        effectiveFps={effectiveFps}
        onRecordPress={isRecording ? stopRecording : startRecording}
        onCycleFps={cycleFps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#a5d4a5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});
