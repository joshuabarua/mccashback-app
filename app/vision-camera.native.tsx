import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
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
import Exposure from '../native/Exposure';
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
  const { selectedFormat, effectiveFps, cameraFps } = useFormatsAndFps(device, fps, setFps);

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

  // Shutter/exposure scaffold state
  const [exposureMode, setExposureMode] = useState<'auto' | 'manual'>('auto');
  const [currentShutterNs, setCurrentShutterNs] = useState<number | null>(null);
  const [showShutterPanel, setShowShutterPanel] = useState(false);
  const [supportsManual, setSupportsManual] = useState<boolean>(false);
  const shutterLabel = useMemo(() => {
    if (exposureMode === 'auto' || !currentShutterNs) return 'Auto Shutter';
    const seconds = currentShutterNs / 1e9;
    if (seconds >= 0.5) return `${seconds.toFixed(1)}s`;
    const denom = Math.round(1 / seconds);
    return `1/${denom}s`;
  }, [exposureMode, currentShutterNs]);

  const onToggleShutter = useCallback(async () => {
    if (!supportsManual) {
      showToast('Manual shutter not supported');
      return;
    }
    try {
      if (exposureMode === 'auto') {
        const fpsForShutter = effectiveFps || fps || 30;
        const exposureNs = Math.round(1e9 / (2 * fpsForShutter)); // 180° shutter
        await Exposure.setManualExposure(exposureNs);
        setCurrentShutterNs(exposureNs);
        setExposureMode('manual');
        setShowShutterPanel(true);
        showToast(`Shutter ${Math.round(fpsForShutter * 2)}° (~${(1e9 / exposureNs).toFixed(0)} fps equiv)`);
      } else {
        await Exposure.enableAutoExposure();
        setExposureMode('auto');
        setCurrentShutterNs(null);
        setShowShutterPanel(false);
        showToast('Shutter Auto');
      }
    } catch (e) {
      console.warn('Shutter toggle failed', e);
      showToast('Shutter not supported');
    }
  }, [exposureMode, effectiveFps, fps, showToast, supportsManual]);

  // Slider configuration (log-scale between ~1/2000s and 1/fps)
  const maxSeconds = useMemo(() => 1 / (effectiveFps || fps || 30), [effectiveFps, fps]);
  const minSeconds = useMemo(() => Math.min(maxSeconds / 16, 1 / 2000), [maxSeconds]);
  const sliderValueFromNs = useCallback((ns: number | null) => {
    if (!ns) return 0.5;
    const s = ns / 1e9;
    const t = (Math.log(s) - Math.log(minSeconds)) / (Math.log(maxSeconds) - Math.log(minSeconds));
    return Math.max(0, Math.min(1, t));
  }, [minSeconds, maxSeconds]);
  const nsFromSliderValue = useCallback((t: number) => {
    const s = Math.exp(Math.log(minSeconds) + t * (Math.log(maxSeconds) - Math.log(minSeconds)));
    return Math.round(s * 1e9);
  }, [minSeconds, maxSeconds]);

  const handleSliderChange = useCallback((t: number) => {
    const ns = nsFromSliderValue(t);
    setCurrentShutterNs(ns);
  }, [nsFromSliderValue]);

  const handleSliderComplete = useCallback(async (t: number) => {
    const ns = nsFromSliderValue(t);
    try {
      await Exposure.setManualExposure(ns);
      setCurrentShutterNs(ns);
    } catch {
      showToast('Shutter not supported');
    }
  }, [nsFromSliderValue, showToast]);

  const setPreset180 = useCallback(async () => {
    const fpsForShutter = effectiveFps || fps || 30;
    const ns = Math.round(1e9 / (2 * fpsForShutter));
    try {
      await Exposure.setManualExposure(ns);
      setCurrentShutterNs(ns);
    } catch {
      showToast('Shutter not supported');
    }
  }, [effectiveFps, fps, showToast]);

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
      // Inform the user that manual focus has been set
      showToast('Manual focus set');
      
      // Clear focus point after 2 seconds
      setTimeout(() => {
        setFocusPoint(null);
      }, 2000);
    } catch (error) {
      console.log('Focus failed:', error);
    }
  }, [showToast]);

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

  // Query exposure capabilities on mount
  useEffect(() => {
    let mounted = true;
    Exposure.getExposureCapabilities()
      .then((caps) => {
        if (mounted) setSupportsManual(!!caps.supportsManual);
      })
      .catch(() => {
        if (mounted) setSupportsManual(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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

      {/* Shutter panel */}
      {showShutterPanel && supportsManual && (
        <View style={[styles.shutterPanel, { bottom: 100 + insets.bottom }]}>
          <Text style={styles.shutterBadge}>{shutterLabel}</Text>
          <View style={styles.shutterRow}>
            <Text style={styles.shutterTick}>{(() => {
              const s = minSeconds;
              return s >= 0.5 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}s`;
            })()}</Text>
            <Slider
              value={sliderValueFromNs(currentShutterNs ?? Math.round(1e9 / (2 * (effectiveFps || fps || 30))))}
              minimumValue={0}
              maximumValue={1}
              onValueChange={handleSliderChange}
              onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor="#a5d4a5"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor="#a5d4a5"
              style={{ flex: 1, marginHorizontal: 12 }}
            />
            <Text style={styles.shutterTick}>{(() => {
              const s = maxSeconds;
              return s >= 0.5 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}s`;
            })()}</Text>
          </View>
          <View style={styles.shutterButtons}>
            <TouchableOpacity style={styles.shutterButton} onPress={setPreset180}>
              <Text style={styles.shutterButtonText}>180°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={() => setShowShutterPanel(false)}>
              <Text style={styles.shutterButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Control overlay */}
      <ControlsOverlay
        insetsBottom={insets.bottom}
        isRecording={isRecording}
        isConfiguring={isConfiguring}
        shutterLabel={shutterLabel}
        onRecordPress={isRecording ? stopRecording : startRecording}
        onShutterPress={onToggleShutter}
        shutterDisabled={!supportsManual}
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
  shutterPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shutterRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shutterTick: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    width: 60,
    textAlign: 'center',
  },
  shutterBadge: {
    alignSelf: 'center',
    color: 'white',
    fontWeight: '700',
  },
  shutterButtons: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shutterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  shutterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
