import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, NativeModules, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS as runOnJSReanimated, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera } from 'react-native-vision-camera';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import BackButton from '../components/BackButton';
import ControlsOverlay from '../components/ControlsOverlay';
import FocusOverlay from '../components/FocusOverlay';
import ToastOverlay from '../components/Toast';
import VisionCameraView from '../components/VisionCameraView';
import ZoetropePanel from '../components/ZoetropePanel';
import { useFormatsAndFps } from '../hooks/useFormatsAndFps';
import { useReconfiguration } from '../hooks/useReconfiguration';
import { useRecording } from '../hooks/useRecording';
import { useShutterMath, formatShutterLabel } from '../hooks/useShutterMath';
import { rpmToStrobeHz, findNearestPreset, isWithinTolerance } from '../utils/zoetrope';
import StrobeOverlay from '../components/StrobeOverlay';
import { useRpmEstimator } from '../hooks/useRpmEstimator';
import { useExposureControl } from '../hooks/useExposureControl';
import ShutterPanel from '../components/ShutterPanel';
import Exposure from '../native/Exposure';
import { RPM_MIN, RPM_MAX, SNAP_WINDOW } from '../constants/Zoetrope';

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
  const [cameraInitialized, setCameraInitialized] = useState(false);
  // Queue for exposure changes while camera is reconfiguring
  const pendingZoetropeRef = useRef<null | { type: 'set' | 'auto'; ns?: number }>(null);

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

  

  // Shutter/exposure UI state and control (extracted)
  const [showShutterPanel, setShowShutterPanel] = useState(false);
  // Zoetrope simple mode
  const [zoetropeEnabled, setZoetropeEnabled] = useState(false);
  // RPM estimation state handled via useRpmEstimator
  // Fixed RPM presets mode (CD player)
  const rpmPresets = useMemo(() => [450, 600, 700, 800, 900] as const, []);
  const [useFixedRpm] = useState(true);
  // Visual strobe parameters (frames per revolution and harmonic)
  const [framesPerRev] = useState<number>(9); // default average across 8–10
  const [harmonic] = useState<number>(1); // default harmonic
  // Only show strobe overlay in development builds (testing only)
  const enableStrobeOverlay = false; // temporarily disabled (toggle remains in code for future testing)
  // Additional guard: disable flashing overlay by default to avoid rapid flicker
  const [visualStrobeEnabled, setVisualStrobeEnabled] = useState(false);
  // Continuous target RPM with persistence
  // Zoetrope constants imported from ../constants/Zoetrope
  const [targetRpm, setTargetRpm] = useState<number>(800);
  // Only access AsyncStorage if the native module is actually linked to avoid runtime errors
  const hasRNCAsyncStorage = useMemo(() => {
    if (Platform.OS === 'web') return false;
    const mods = NativeModules ?? {};
    const keys = Object.keys(mods);
    // Match any native module whose name contains "AsyncStorage"
    return keys.some((k) => k.toLowerCase().includes('asyncstorage'));
  }, []);
  useEffect(() => {
    if (!hasRNCAsyncStorage) return;
    (async () => {
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        const v = await AsyncStorage.getItem('targetRpm');
        if (v) {
          const n = Math.max(RPM_MIN, Math.min(RPM_MAX, parseInt(v, 10) || 300));
          setTargetRpm(n);
        }
      } catch {}
    })();
  }, [hasRNCAsyncStorage]);
  useEffect(() => {
    if (!hasRNCAsyncStorage) return;
    (async () => {
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('targetRpm', String(targetRpm));
      } catch {}
    })();
  }, [targetRpm, hasRNCAsyncStorage]);

  // Exposure control hook
  const {
    exposureMode,
    setExposureMode,
    currentShutterNs,
    setCurrentShutterNs,
    supportsManual,
    caps,
    handleSliderChangeNs,
    handleSliderCompleteNs,
    setPreset180,
  } = useExposureControl({
    cameraInitialized,
    effectiveFps,
    fps,
    zoetropeEnabled,
    isConfiguring,
    cameraReadyRef,
    pendingZoetropeRef,
    showToast,
  });

  const shutterLabel = useMemo(() => formatShutterLabel(exposureMode, currentShutterNs), [exposureMode, currentShutterNs]);

  // Removed Zoetrope FPS slider; we auto-set to max when enabling Zoetrope

  // Spinning disc animation for auto-estimation state
  const isEstimating = zoetropeEnabled && !useFixedRpm;
  const spin = useSharedValue(0);
  useEffect(() => {
    if (isEstimating) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 1500, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
      spin.value = 0;
    }
  }, [isEstimating, spin]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  // Visual strobe overlay (animation logic extracted into StrobeOverlay component)

  // Guard: disable frame processor at high FPS to avoid memory spikes/crashes
  const shouldUseFrameProcessor = useMemo(() => {
    const f = effectiveFps || fps || 30;
    return zoetropeEnabled && !useFixedRpm && f <= 60; // only process frames at <=60 FPS
  }, [zoetropeEnabled, useFixedRpm, effectiveFps, fps]);

  // Slider configuration (log-scale between ~1/2000s and 1/fps)
  const { minSeconds, maxSeconds, sliderValueFromNs, nsFromSliderValue } = useShutterMath(effectiveFps, fps);

  // RPM estimator hook (autocorrelation + EMA + gating)
  const { rpm: rpmMeasured, suggestionPreset, setSuggestionPreset, frameProcessor } = useRpmEstimator({
    enabled: shouldUseFrameProcessor,
    sampleRate: effectiveFps || fps || 30,
    rpmMin: RPM_MIN,
    rpmMax: RPM_MAX,
    presets: rpmPresets,
  });

  // Displayed RPM depends on mode: fixed uses the target, detection uses measured
  const rpmDisplay = useMemo(() => (useFixedRpm ? targetRpm : rpmMeasured), [useFixedRpm, targetRpm, rpmMeasured]);

  // Check if displayed RPM matches a typical CD spin rate (nearest preset within tolerance)
  const cdMatch = useMemo(() => {
    if (rpmDisplay == null) return null as null | { nearest: number; isMatch: boolean; delta: number };
    const { nearest, delta } = findNearestPreset(rpmDisplay, rpmPresets);
    const tolerance = 10; // rpm tolerance for a "match"
    return { nearest, isMatch: isWithinTolerance(rpmDisplay, nearest, tolerance), delta };
  }, [rpmDisplay, rpmPresets]);

  // Strobe frequency derived from displayed RPM and pattern parameters
  const strobeHz = useMemo(() => rpmToStrobeHz(rpmDisplay ?? targetRpm, framesPerRev, harmonic), [rpmDisplay, targetRpm, framesPerRev, harmonic]);

  // Slider handlers are provided by useExposureControl and passed to ShutterPanel directly

  // Inline RPM estimation logic removed in favor of useRpmEstimator

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
      runOnJSReanimated(focus)({ x, y });
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

  // Handle Zoetrope toggle (moved into overlay)
  const handleZoetropePress = useCallback(async () => {
    const next = !zoetropeEnabled;
    setZoetropeEnabled(next);
    if (next) {
      // Default to a comfortable preview FPS to avoid dark image on high FPS
      const chosen = 30;
      setFps(chosen);
      // Do not force manual exposure on enable; keep the user's current exposure mode.
      // If the user had already selected manual exposure, gently set a reasonable shutter for the chosen FPS.
      if (supportsManual && exposureMode === 'manual') {
        const fallback = Math.round(1e9 / (2 * chosen)); // ~1/60s at 30 FPS
        const minNs = caps?.minExposureNs ?? fallback;
        const maxNs = caps?.maxExposureNs ?? fallback;
        const desired = Math.max(minNs, Math.min(maxNs, fallback));
        if (cameraReadyRef.current && !isConfiguring) {
          try {
            await Exposure.setManualExposure(desired, undefined);
            setCurrentShutterNs(desired);
          } catch (e) {
            console.error('Exposure.setManualExposure failed on enable', e);
            showToast('Failed to set manual exposure');
          }
        } else {
          pendingZoetropeRef.current = { type: 'set', ns: desired };
        }
      }
    } else {
      if (cameraReadyRef.current && !isConfiguring) {
        try {
          await Exposure.enableAutoExposure();
          setExposureMode('auto');
          setCurrentShutterNs(null);
        } catch (e) {
          console.error('Exposure.enableAutoExposure failed on disable', e);
          showToast('Failed to enable auto exposure');
        }
      } else {
        pendingZoetropeRef.current = { type: 'auto' };
      }
    }
  }, [zoetropeEnabled, supportsManual, caps, isConfiguring, setFps, setExposureMode, setCurrentShutterNs, showToast, exposureMode]);

  // exposure capability query moved into useExposureControl

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

  // Debug: log all formats when device changes to inspect max fps availability
  useEffect(() => {
    if (!device) return;
    const formats = (device.formats ?? []).map((f) => ({
      w: f.videoWidth,
      h: f.videoHeight,
      min: f.minFps,
      max: f.maxFps,
    }));
    formats.sort((a, b) => (b.max ?? 0) - (a.max ?? 0));
    console.log('Device formats (sorted by max fps):', formats);
  }, [device]);

  // shutter maintenance moved into useExposureControl

  

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
          onInitialized={() => {
            cameraReadyRef.current = true;
            setCameraInitialized(true);
            const pending = pendingZoetropeRef.current;
            if (pending) {
              pendingZoetropeRef.current = null;
              (async () => {
                try {
                  if (pending.type === 'set' && pending.ns != null) {
                    await Exposure.setManualExposure(pending.ns, caps?.maxIso);
                    setExposureMode('manual');
                    setCurrentShutterNs(pending.ns);
                  } else if (pending.type === 'auto') {
                    await Exposure.enableAutoExposure();
                    setExposureMode('auto');
                    setCurrentShutterNs(null);
                  }
                } catch (e) {
                  console.error('Applying pending exposure change failed', e);
                }
              })();
            }
          }}
          frameProcessor={shouldUseFrameProcessor ? frameProcessor : undefined}
        />
      </GestureDetector>

      {/* Visual strobe overlay (UI flash) - gated by dev and explicit enable */}
      <StrobeOverlay
        enabled={zoetropeEnabled && enableStrobeOverlay && visualStrobeEnabled}
        strobeHz={strobeHz}
        maxDisplayHz={15}
      />

      {/* RPM overlay */}
      {zoetropeEnabled && (
        <View style={{ position: 'absolute', top: 16 + insets.top, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isEstimating && (
              <Animated.View style={spinStyle}>
                <Image source={require('../assets/images/icon.png')} style={{ width: 14, height: 14, tintColor: 'white' }} />
              </Animated.View>
            )}
            <Text style={{ color: 'white', fontWeight: '700' }}>
              {`RPM: ${rpmDisplay != null ? Math.round(rpmDisplay) : '—'}`}
              {isEstimating && rpmDisplay != null && cdMatch ? `  •  CD: ${cdMatch.nearest}${cdMatch.isMatch ? ' ✓' : ''}` : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Shutter overlay */}
      {zoetropeEnabled && (
        <View style={{ position: 'absolute', top: 16 + insets.top, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{shutterLabel}</Text>
        </View>
      )}

      {/* Toast */}
      {toast && <ToastOverlay message={toast} bottom={140 + insets.bottom} />}

      {/* Focus indicator */}
      <FocusOverlay point={focusPoint} />

      {/* Back button */}
      <BackButton onPress={handleBack} />

      {/* Detection suggestion */}
      {isEstimating && suggestionPreset != null && (
        <View style={{ position: 'absolute', bottom: 140 + insets.bottom, alignSelf: 'center' }}>
          <TouchableOpacity
            style={styles.suggestionPill}
            onPress={() => {
              setTargetRpm(suggestionPreset);
              setSuggestionPreset(null);
              showToast(`Set to ${suggestionPreset} RPM`);
            }}
          >
            <Text style={styles.suggestionText}>{`Set to ${suggestionPreset}`}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Shutter panel */}
      {showShutterPanel && supportsManual && (
        <ShutterPanel
          bottom={100 + insets.bottom}
          shutterLabel={shutterLabel}
          minSeconds={minSeconds}
          maxSeconds={maxSeconds}
          currentShutterNs={currentShutterNs ?? Math.round(1e9 / (2 * (effectiveFps || fps || 30)))}
          sliderValueFromNs={sliderValueFromNs}
          nsFromSliderValue={nsFromSliderValue}
          onValueChangeNs={handleSliderChangeNs}
          onSlidingCompleteNs={handleSliderCompleteNs}
          onPreset180={setPreset180}
          onClose={() => setShowShutterPanel(false)}
        />
      )}

      {/* Zoetrope simple panel */}
      {zoetropeEnabled && (
        <ZoetropePanel
          bottom={180 + insets.bottom}
          targetRpm={targetRpm}
          setTargetRpm={setTargetRpm}
          rpmPresets={rpmPresets}
          rpmMin={RPM_MIN}
          rpmMax={RPM_MAX}
          snapWindow={SNAP_WINDOW}
          enableStrobeOverlay={enableStrobeOverlay}
          visualStrobeEnabled={visualStrobeEnabled}
          setVisualStrobeEnabled={setVisualStrobeEnabled}
        />
      )}

      {/* Control overlay */}
      <ControlsOverlay
        insetsBottom={insets.bottom}
        isRecording={isRecording}
        isConfiguring={isConfiguring}
        onRecordPress={isRecording ? stopRecording : startRecording}
        zoetropeEnabled={zoetropeEnabled}
        onZoetropePress={handleZoetropePress}
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
  // Shutter panel styles were moved to components/ShutterPanel.tsx
  suggestionPill: {
    backgroundColor: 'rgba(165,212,165,0.2)',
    borderColor: 'rgba(165,212,165,0.6)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'center',
  },
  suggestionText: {
    color: 'white',
    fontWeight: '700',
  },
});
