import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, Platform, NativeModules } from 'react-native';
import Slider from '@react-native-community/slider';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS as runOnJSReanimated, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useRunOnJS } from 'react-native-worklets-core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera } from 'react-native-vision-camera';
import { useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import BackButton from '../components/BackButton';
import ControlsOverlay from '../components/ControlsOverlay';
import FocusOverlay from '../components/FocusOverlay';
import ToastOverlay from '../components/Toast';
import VisionCameraView from '../components/VisionCameraView';
import { useFormatsAndFps } from '../hooks/useFormatsAndFps';
import Exposure, { type ExposureCapabilities } from '../native/Exposure';
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

  

  // Shutter/exposure scaffold state
  const [exposureMode, setExposureMode] = useState<'auto' | 'manual'>('auto');
  const [currentShutterNs, setCurrentShutterNs] = useState<number | null>(null);
  const [showShutterPanel, setShowShutterPanel] = useState(false);
  const [supportsManual, setSupportsManual] = useState<boolean>(false);
  const [caps, setCaps] = useState<ExposureCapabilities | null>(null);
  // Zoetrope simple mode
  const [zoetropeEnabled, setZoetropeEnabled] = useState(false);
  // RPM estimation state
  const [rpm, setRpm] = useState<number | null>(null);
  const intensityBufferRef = useRef<number[]>([]);
  const rpmEmaRef = useRef<number | null>(null);
  // Fixed RPM presets mode (CD player)
  const rpmPresets = useMemo(() => [200, 300, 400, 500] as const, []);
  const [useFixedRpm, setUseFixedRpm] = useState(false);
  // Continuous target RPM with persistence
  const RPM_MIN = 150;
  const RPM_MAX = 600;
  const SNAP_WINDOW = 8;
  const [targetRpm, setTargetRpm] = useState<number>(300);
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

  // Check if measured RPM matches a typical CD spin rate (nearest preset within tolerance)
  const cdMatch = useMemo(() => {
    if (rpm == null) return null as null | { nearest: number; isMatch: boolean; delta: number };
    let nearest: number = rpmPresets[0];
    let best = Math.abs(rpm - nearest);
    for (const p of rpmPresets) {
      const d = Math.abs(rpm - p);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    const tolerance = 10; // rpm tolerance for a "match"
    return { nearest, isMatch: best <= tolerance, delta: best };
  }, [rpm, rpmPresets]);
  const shutterLabel = useMemo(() => {
    if (exposureMode === 'auto' || !currentShutterNs) return 'Auto Shutter';
    const seconds = currentShutterNs / 1e9;
    if (seconds >= 0.5) return `${seconds.toFixed(1)}s`;
    const denom = Math.round(1 / seconds);
    return `1/${denom}s`;
  }, [exposureMode, currentShutterNs]);

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

  // Host-side intensity ingestion and RPM estimation using autocorrelation (with clamping + confidence gating)
  const RN_THRESH = 0.35;
  const stableFramesRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const [suggestionPreset, setSuggestionPreset] = useState<number | null>(null);

  const onFrameSample = useCallback((avgIntensity: number) => {
    const buf = intensityBufferRef.current;
    buf.push(avgIntensity);
    const maxLen = 512;
    if (buf.length > maxLen) buf.splice(0, buf.length - maxLen);
    const sr = effectiveFps || fps || 30; // samples per second
    if (buf.length < Math.max(32, sr)) return; // need at least ~1s of data
    // Detrend
    const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
    const x = buf.map((v) => v - mean);
    const N = x.length;
    // Clamp lags to RPM_MIN..RPM_MAX
    const kMin = Math.max(2, Math.floor((sr * 60) / RPM_MAX));
    const kMax = Math.min(Math.floor(N / 2), Math.ceil((sr * 60) / RPM_MIN));
    if (kMax <= kMin) return;
    let bestLag = 0;
    let bestRn = -Infinity;
    for (let k = kMin; k <= kMax; k++) {
      let r = 0;
      let e0 = 0;
      let e1 = 0;
      for (let i = 0; i < N - k; i++) {
        const a = x[i];
        const b = x[i + k];
        r += a * b;
        e0 += a * a;
        e1 += b * b;
      }
      const rn = r / (Math.sqrt(e0 * e1) + 1e-9);
      if (rn > bestRn) {
        bestRn = rn;
        bestLag = k;
      }
    }
    const isEdge = bestLag === kMin || bestLag === kMax;
    const isConfident = bestLag > 0 && bestRn >= RN_THRESH && !isEdge;
    if (isConfident) {
      const hz = sr / bestLag;
      const rawRpm = Math.max(RPM_MIN, Math.min(RPM_MAX, hz * 60));
      const alpha = 0.2; // EMA smoothing
      const prev = rpmEmaRef.current ?? rawRpm;
      const smoothed = prev + alpha * (rawRpm - prev);
      rpmEmaRef.current = smoothed;
      stableFramesRef.current += 1;
      if (stableFramesRef.current >= 3) {
        setRpm(smoothed);
        // Stable-match suggestion gating (>=1s within ±10 of a preset)
        let nearest: number = rpmPresets[0];
        let best = Math.abs(smoothed - nearest);
        for (const p of rpmPresets) {
          const d = Math.abs(smoothed - p);
          if (d < best) { best = d; nearest = p; }
        }
        const now = Date.now();
        if (best <= 10) {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          if (now - (stableSinceRef.current ?? now) >= 1000) {
            setSuggestionPreset(nearest);
          }
        } else {
          stableSinceRef.current = null;
          setSuggestionPreset(null);
        }
      }
    } else {
      stableFramesRef.current = 0;
      rpmEmaRef.current = null;
      setRpm(null);
      stableSinceRef.current = null;
      setSuggestionPreset(null);
    }
  }, [effectiveFps, fps, rpmPresets]);

  // Create a JS-callback that can be called from a worklet safely
  const onFrameSampleJS = useRunOnJS(onFrameSample, [onFrameSample]);

  // Frame processor: compute avg luminance from Y plane (YUV) or RGB sample if available
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const w = frame.width;
    const h = frame.height;
    let avg = -1;
    if (frame.pixelFormat === 'yuv') {
      const stride = frame.bytesPerRow;
      const buf = frame.toArrayBuffer();
      const data = new Uint8Array(buf);
      // sample a coarse grid on Y plane (first plane)
      const stepY = Math.max(1, Math.floor(h / 64));
      const stepX = Math.max(1, Math.floor(w / 64));
      let sum = 0;
      let cnt = 0;
      for (let y = 0; y < h; y += stepY) {
        const rowOff = y * stride;
        for (let x = 0; x < w; x += stepX) {
          sum += data[rowOff + x];
          cnt++;
        }
      }
      avg = cnt > 0 ? sum / cnt : -1;
    } else if (frame.pixelFormat === 'rgb') {
      const buf = frame.toArrayBuffer();
      const data = new Uint8Array(buf);
      const cx = Math.floor(w / 2);
      const stepY = Math.max(1, Math.floor(h / 64));
      let sum = 0;
      let cnt = 0;
      for (let y = 0; y < h; y += stepY) {
        const idx = (y * w + cx) * 4; // RGBA
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        cnt++;
      }
      avg = cnt > 0 ? sum / cnt : -1;
    }
    if (avg >= 0) {
      // send to JS thread via a pre-created runOnJS callback
      onFrameSampleJS(avg);
    }
  }, [onFrameSampleJS]);

  // When using fixed RPM presets, keep overlay RPM in sync and avoid using frame processor
  useEffect(() => {
    if (zoetropeEnabled && useFixedRpm) {
      setRpm(targetRpm);
    }
  }, [zoetropeEnabled, useFixedRpm, targetRpm]);

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
      // Auto-set FPS to the device's maximum supported fps across formats
      const list = supportedFpsOptions ?? [];
      const max = list.length ? Math.max(...list) : (selectedFormat?.maxFps ?? 60);
      setFps(max);
      if (supportsManual) {
        // Force shortest possible shutter: use device's minimum supported exposure when available
        const fallback = Math.round(1e9 / (4 * max));
        const desired = caps?.minExposureNs ?? fallback;
        const minNs = caps?.minExposureNs ?? desired;
        const maxNs = caps?.maxExposureNs ?? desired;
        const clamped = Math.max(minNs, Math.min(maxNs, desired));
        if (cameraReadyRef.current && !isConfiguring) {
          try {
            await Exposure.setManualExposure(clamped, caps?.maxIso);
            setExposureMode('manual');
            setCurrentShutterNs(clamped);
          } catch {}
        } else {
          pendingZoetropeRef.current = { type: 'set', ns: clamped };
        }
      }
    } else {
      if (cameraReadyRef.current && !isConfiguring) {
        try {
          await Exposure.enableAutoExposure();
          setExposureMode('auto');
          setCurrentShutterNs(null);
        } catch {}
      } else {
        pendingZoetropeRef.current = { type: 'auto' };
      }
    }
  }, [zoetropeEnabled, selectedFormat, supportsManual, caps, isConfiguring, setFps, setExposureMode, setCurrentShutterNs, supportedFpsOptions]);

  // Query exposure capabilities on mount
  useEffect(() => {
    let mounted = true;
    Exposure.getExposureCapabilities()
      .then((caps) => {
        if (!mounted) return;
        setSupportsManual(!!caps.supportsManual);
        setCaps(caps);
      })
      .catch(() => {
        if (!mounted) return;
        setSupportsManual(false);
        setCaps(null);
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

  // While Zoetrope is enabled, keep shutter at the shortest supported exposure
  useEffect(() => {
    if (!zoetropeEnabled || !supportsManual) return;
    const targetFps = effectiveFps || fps || 30;
    const fallback = Math.round(1e9 / (4 * targetFps));
    const desired = caps?.minExposureNs ?? fallback;
    const minNs = caps?.minExposureNs ?? desired;
    const maxNs = caps?.maxExposureNs ?? desired;
    const clamped = Math.max(minNs, Math.min(maxNs, desired));
    const tol = 1e6; // 1ms tolerance
    const needsUpdate = currentShutterNs == null || Math.abs(currentShutterNs - clamped) > tol || exposureMode !== 'manual';
    if (!needsUpdate) return;
    if (cameraReadyRef.current && !isConfiguring) {
      (async () => {
        try {
          await Exposure.setManualExposure(clamped, caps?.maxIso);
          setExposureMode('manual');
          setCurrentShutterNs(clamped);
        } catch {}
      })();
    } else {
      pendingZoetropeRef.current = { type: 'set', ns: clamped };
    }
  }, [zoetropeEnabled, supportsManual, caps, effectiveFps, fps, isConfiguring, currentShutterNs, exposureMode]);

  

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
                } catch {}
              })();
            }
          }}
          frameProcessor={zoetropeEnabled && !useFixedRpm ? frameProcessor : undefined}
        />
      </GestureDetector>

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
              {`RPM: ${rpm != null ? Math.round(rpm) : '—'}`}
              {isEstimating && rpm != null && cdMatch ? `  •  CD: ${cdMatch.nearest}${cdMatch.isMatch ? ' ✓' : ''}` : ''}
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
              setUseFixedRpm(true);
              setTargetRpm(suggestionPreset);
              setSuggestionPreset(null);
              stableSinceRef.current = null;
              showToast(`Set to ${suggestionPreset} RPM`);
            }}
          >
            <Text style={styles.suggestionText}>{`Set to ${suggestionPreset}`}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Zoetrope simple panel */}
      {zoetropeEnabled && (
        <View style={[styles.shutterPanel, { bottom: 180 + insets.bottom }]}> 
          {/* Detect toggle + continuous RPM slider */}
          <View style={[styles.shutterRow, { marginTop: 10 }]}> 
            <TouchableOpacity
              style={[styles.shutterButton, { marginRight: 8, backgroundColor: useFixedRpm ? 'rgba(165,212,165,0.35)' : 'rgba(255,255,255,0.15)' }]}
              onPress={() => setUseFixedRpm((p) => !p)}
            >
              <Text style={styles.shutterButtonText}>{useFixedRpm ? 'Fixed RPM: On' : 'Detect: On'}</Text>
            </TouchableOpacity>
            <Text style={styles.shutterTick}>RPM</Text>
            <Slider
              value={targetRpm}
              minimumValue={RPM_MIN}
              maximumValue={RPM_MAX}
              step={1}
              onValueChange={(val) => {
                const n = Array.isArray(val) ? (val[0] as number) : (val as number);
                setTargetRpm(Math.max(RPM_MIN, Math.min(RPM_MAX, Math.round(n))));
              }}
              onSlidingComplete={(val) => {
                const n = Array.isArray(val) ? (val[0] as number) : (val as number);
                let nearest: number = rpmPresets[0];
                let best = Math.abs(n - nearest);
                for (const p of rpmPresets) {
                  const d = Math.abs(n - p);
                  if (d < best) { best = d; nearest = p; }
                }
                if (best <= SNAP_WINDOW) setTargetRpm(nearest);
              }}
              minimumTrackTintColor="#a5d4a5"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor="#a5d4a5"
              style={{ flex: 1, marginHorizontal: 12 }}
            />
            <Text style={styles.shutterTick}>{(() => {
              let nearest: number = rpmPresets[0];
              let best = Math.abs(targetRpm - nearest);
              for (const p of rpmPresets) {
                const d = Math.abs(targetRpm - p);
                if (d < best) { best = d; nearest = p; }
              }
              return best <= SNAP_WINDOW ? `CD: ${nearest} ✓` : String(targetRpm);
            })()}</Text>
          </View>
        </View>
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
