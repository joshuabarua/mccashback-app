import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS as runOnJSReanimated } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera } from 'react-native-vision-camera';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import BackButton from '../components/BackButton';
import FocusOverlay from '../components/FocusOverlay';
import ShutterPanel from '../components/ShutterPanel';
import StrobeOverlay from '../components/StrobeOverlay';
import ToastOverlay from '../components/Toast';
import VisionCameraView from '../components/VisionCameraView';
import ZoetropePanel from '../components/ZoetropePanel';
import { RPM_MAX, RPM_MIN, SNAP_WINDOW } from '../constants/Zoetrope';
import { useExposureControl } from '../hooks/useExposureControl';
import { useFormatsAndFps } from '../hooks/useFormatsAndFps';
import { useReconfiguration } from '../hooks/useReconfiguration';
import { formatShutterLabel, useShutterMath } from '../hooks/useShutterMath';
import Exposure from '../native/Exposure';
import { rpmToStrobeHz } from '../utils/zoetrope';
import { useImuTachometer } from '../hooks/useImuTachometer';

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
  
  const [isActive, setIsActive] = useState(true);
  const [fps, setFps] = useState(30);
  const [focusPoint, setFocusPoint] = useState<Point | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraReadyRef = useRef(false);
  const prevFpsRef = useRef(fps);
  const [remounting, setRemounting] = useState(false);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const pendingZoetropeRef = useRef<null | { type: 'set'; ns: number }>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);
  
  
  const { selectedFormat, effectiveFps, cameraFps } = useFormatsAndFps(device, fps, setFps);

  const cameraKey = useMemo(() => {
    const base = `${selectedFormat?.videoWidth}x${selectedFormat?.videoHeight}-${selectedFormat?.minFps}-${selectedFormat?.maxFps}`;
    const fpsPart = cameraFps == null ? 'auto' : String(cameraFps);
    return `${base}-${fpsPart}`;
  }, [selectedFormat, cameraFps]);

  
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

  
  const [showShutterPanel, setShowShutterPanel] = useState(false);
  const rpmPresets = useMemo(() => [300, 600, 700, 800, 900] as const, []);
  const [framesPerRev, setFramesPerRev] = useState<number>(1);
  const [harmonic, setHarmonic] = useState<number>(1);
  const enableStrobeOverlay = false;
  const [visualStrobeEnabled, setVisualStrobeEnabled] = useState(false);
  const [targetRpm, setTargetRpm] = useState<number>(350);
  const [torchStrobeEnabled, setTorchStrobeEnabled] = useState<boolean>(false);
  const [torchState, setTorchState] = useState<'on' | 'off'>('on');
  const [imuTachEnabled, setImuTachEnabled] = useState<boolean>(false);
  const [manualRpmRounded, setManualRpmRounded] = useState<number>(0);
  const manualBufRef = useRef<number[]>([]);
  const lastMarkTimeRef = useRef<number | null>(null);
  const hasRNCAsyncStorage = useMemo(() => {
    if (Platform.OS === 'web') return false;
    const mods = NativeModules ?? {};
    const keys = Object.keys(mods);
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
    zoetropeEnabled: true,
    isConfiguring,
    cameraReadyRef,
    pendingZoetropeRef,
    showToast,
  });

  const shutterLabel = useMemo(() => formatShutterLabel(exposureMode, currentShutterNs), [exposureMode, currentShutterNs]);

  const { minSeconds, maxSeconds, sliderValueFromNs, nsFromSliderValue } = useShutterMath(effectiveFps, fps);
  const strobeHz = useMemo(() => rpmToStrobeHz(targetRpm, framesPerRev, harmonic), [targetRpm, framesPerRev, harmonic]);

  // IMU-based tachometer (non-strobing)
  const { rounded: imuRpmRounded, available: imuAvailable } = useImuTachometer({ enabled: imuTachEnabled, windowSize: 16, updateIntervalMs: 16 });

  const { torchHz, harmonicUsed } = useMemo(() => {
    if (!torchStrobeEnabled || !isActive || !Number.isFinite(strobeHz) || strobeHz <= 0) {
      return { torchHz: 0, harmonicUsed: 1 } as const;
    }
    const maxTorchHz = 15;
    const divisor = Math.max(1, Math.ceil(strobeHz / maxTorchHz));
    return { torchHz: strobeHz / divisor, harmonicUsed: divisor } as const;
  }, [torchStrobeEnabled, isActive, strobeHz]);

  const onMarkPass = useCallback(() => {
    const now = Date.now();
    const prev = lastMarkTimeRef.current;
    lastMarkTimeRef.current = now;
    if (prev == null) return;
    const dt = (now - prev) / 1000; // seconds
    if (dt <= 0) return;
    // If user taps on each visible mark pass, scale by framesPerRev
    const rpm = (60 / dt) / Math.max(1, framesPerRev);
    const buf = manualBufRef.current;
    buf.push(rpm);
    const maxN = 6;
    if (buf.length > maxN) buf.shift();
    const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
    setManualRpmRounded(Math.round(mean));
  }, [framesPerRev]);

  // Drive the device torch in a strobing pattern at a display-safe harmonic of the desired strobe frequency
  useEffect(() => {
    // Keep torch on if strobing is disabled or torchHz invalid
    if (!device || torchHz <= 0) {
      setTorchState('on');
      return;
    }
    const toggleMs = Math.max(10, Math.round(1000 / (torchHz * 2))); // half-period per toggle
    let on = true;
    setTorchState(on ? 'on' : 'off');
    const id = setInterval(() => {
      on = !on;
      setTorchState(on ? 'on' : 'off');
    }, toggleMs);
    return () => {
      clearInterval(id);
      // Ensure we leave the torch on for illumination when stopping strobe
      setTorchState('on');
    };
  }, [device, torchHz]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const focus = useCallback((point: Point) => {
    const camera = cameraRef.current;
    if (camera == null) return;
    
    try {
      camera.focus(point);
      setFocusPoint(point);
      showToast('Manual focus set');
      setTimeout(() => {
        setFocusPoint(null);
      }, 2000);
    } catch (error) {
      if (__DEV__) console.log('Focus failed:', error);
    }
  }, [showToast]);

  const tapGesture = Gesture.Tap()
    .onEnd(({ x, y }) => {
      runOnJSReanimated(focus)({ x, y });
    });

  const handleBack = () => {
    setIsActive(false);
    router.back();
  };

  useEffect(() => {
    if (!selectedFormat) return;
    if (__DEV__) console.log('Selected format change:', {
      w: selectedFormat.videoWidth,
      h: selectedFormat.videoHeight,
      min: selectedFormat.minFps,
      max: selectedFormat.maxFps,
      targetFps: fps,
      cameraFps,
    });
  }, [selectedFormat, fps, cameraFps]);
  useEffect(() => {
    if (!device) return;
    const formats = (device.formats ?? []).map((f) => ({
      w: f.videoWidth,
      h: f.videoHeight,
      min: f.minFps,
      max: f.maxFps,
    }));
    formats.sort((a, b) => (b.max ?? 0) - (a.max ?? 0));
    if (__DEV__) console.log('Device formats (sorted by max fps):', formats);
  }, [device]);


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
          torch={torchState}
          onInitialized={() => {
            cameraReadyRef.current = true;
            setCameraInitialized(true);
            const pending = pendingZoetropeRef.current;
            if (pending) {
              pendingZoetropeRef.current = null;
              (async () => {
                try {
                  if (pending.type === 'set') {
                    await Exposure.setManualExposure(pending.ns, caps?.maxIso);
                    setExposureMode('manual');
                    setCurrentShutterNs(pending.ns);
                  }
                } catch (e) {
                  console.error('Applying pending exposure change failed', e);
                }
              })();
            }
          }}
        />
      </GestureDetector>
      <StrobeOverlay enabled={enableStrobeOverlay && visualStrobeEnabled} strobeHz={strobeHz} maxDisplayHz={15} />
      <View style={{ position: 'absolute', top: 16 + insets.top, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{`RPM: ${Math.round(targetRpm)}`}</Text>
        </View>
      </View>
      {torchStrobeEnabled && (
        <View style={{ position: 'absolute', top: 50 + insets.top, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{`Torch strobe: ${torchHz.toFixed(2)} Hz (m=${harmonic}×${harmonicUsed}=${harmonic * harmonicUsed})`}</Text>
        </View>
      )}
      <View style={{ position: 'absolute', top: 16 + insets.top, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>{shutterLabel}</Text>
      </View>
      {toast && <ToastOverlay message={toast} bottom={140 + insets.bottom} />}
      <FocusOverlay point={focusPoint} />
      <BackButton onPress={handleBack} />
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
      <ZoetropePanel
        bottom={64 + insets.bottom}
        targetRpm={targetRpm}
        setTargetRpm={setTargetRpm}
        rpmPresets={rpmPresets}
        rpmMin={RPM_MIN}
        rpmMax={RPM_MAX}
        snapWindow={SNAP_WINDOW}
        enableStrobeOverlay={enableStrobeOverlay}
        visualStrobeEnabled={visualStrobeEnabled}
        setVisualStrobeEnabled={setVisualStrobeEnabled}
        torchStrobeEnabled={torchStrobeEnabled}
        setTorchStrobeEnabled={setTorchStrobeEnabled}
        onMarkPass={onMarkPass}
        manualRpmRounded={manualRpmRounded}
        imuTachEnabled={imuTachEnabled}
        setImuTachEnabled={setImuTachEnabled}
        imuRpmRounded={imuRpmRounded}
        framesPerRev={framesPerRev}
        setFramesPerRev={setFramesPerRev}
        harmonic={harmonic}
        setHarmonic={setHarmonic}
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
})
