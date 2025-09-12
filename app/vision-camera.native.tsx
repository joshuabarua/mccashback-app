import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission, type Camera, type CameraDeviceFormat } from 'react-native-vision-camera';
import BackButton from '../components/BackButton';
import VisionCameraView from '../components/VisionCameraView';
import { useFormatsAndFps } from '../hooks/useFormatsAndFps';
import Exposure from '../native/Exposure';

export default function VisionCameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();

  // Strobe method state
  const [isActive, setIsActive] = useState(true);
  const [requestedHz, setRequestedHz] = useState(24);
  const [appliedHz, setAppliedHz] = useState(24);
  const [torch, setTorch] = useState<'on' | 'off'>('off');
  const [lowFpsNative, setLowFpsNative] = useState(false);
  const [nativeFormat, setNativeFormat] = useState<CameraDeviceFormat | undefined>(undefined);
  const [nativeApplied, setNativeApplied] = useState<{ appliedFps: number; width: number; height: number } | undefined>(undefined);
  const lowFpsAvailable = useMemo(() => Exposure.isLowFpsAvailable?.() ?? false, []);
  const [fineOffset, setFineOffset] = useState(0); // Hz detune for slow drift (native-only)
  const [driftMode, setDriftMode] = useState(false); // Software drift around target when native not linked
  const [safeModeIOS, setSafeModeIOS] = useState(true); // Avoid explicit fps on iOS to reduce AVFoundation errors

  // Pick a camera format that supports the requested FPS (requestedHz)
  // Always use extended options so the slider can reach lower Hz like the previous +/- buttons.
  const { selectedFormat, effectiveFps, cameraFps, supportedFpsOptions } = useFormatsAndFps(device, requestedHz, setAppliedHz, false, true);

  // Lock a format to reduce reconfiguration churn on iOS
  const [lockedFormat, setLockedFormat] = useState<CameraDeviceFormat | undefined>(undefined);

  const iosSupportsRate = useCallback((f: CameraDeviceFormat | undefined, v: number) => {
    if (!f) return false;
    const min = (f.minFps ?? 0);
    const max = (f.maxFps ?? 0);
    if (Platform.OS === 'ios') {
      if (v === 24) return min <= 24.5 && max >= 23.5;
      if (v === 30) return min <= 30.5 && max >= 29.5;
      if (v === 60) return min <= 60.5 && max >= 59.0;
    }
    return min <= v && max >= v;
  }, []);

  // Initialize or update locked format only when needed
  useEffect(() => {
    if (!device) return;
    if (lockedFormat == null) {
      setLockedFormat(selectedFormat);
      return;
    }
    if (iosSupportsRate(lockedFormat, requestedHz)) return;
    // Find a new format that supports the appliedHz, prefer closest area to current locked
    const area = (f: CameraDeviceFormat) => (Number(f.videoWidth) || 0) * (Number(f.videoHeight) || 0);
    const lockedArea = lockedFormat ? area(lockedFormat) : 0;
    const candidates = (device.formats ?? []).filter((f) => iosSupportsRate(f, requestedHz));
    if (candidates.length) {
      const next = candidates.sort((a, b) => Math.abs(area(a) - lockedArea) - Math.abs(area(b) - lockedArea))[0];
      setLockedFormat(next);
    }
  }, [device, selectedFormat, requestedHz, lockedFormat, iosSupportsRate]);


  const cameraKey = useMemo(() => {
    // Include native low-FPS format in key to ensure Camera remounts when switching
    const fmt = lowFpsNative && nativeFormat ? nativeFormat : (lockedFormat ?? selectedFormat);
    const base = `${fmt?.videoWidth}x${fmt?.videoHeight}-${fmt?.minFps}-${fmt?.maxFps}`;
    const fpsPart = (lowFpsNative || cameraFps == null) ? 'auto' : String(cameraFps);
    return `${base}-${fpsPart}-${lowFpsNative ? 'native' : 'std'}`;
  }, [lockedFormat, selectedFormat, cameraFps, lowFpsNative, nativeFormat]);

  // When native low-FPS is OFF, let VisionCamera apply fps (including low values like 5/6);
  // when ON, avoid passing fps to prevent conflicts; when iOS Safe mode is ON, also avoid explicit fps.
  const cameraFpsProp = useMemo(() => {
    if (Platform.OS === 'ios' && safeModeIOS) return undefined;
    return lowFpsNative ? undefined : cameraFps;
  }, [cameraFps, lowFpsNative, safeModeIOS]);

  // Ensure camera permission
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Apply native low-FPS configuration when enabled (includes fine detune)
  useEffect(() => {
    if (!lowFpsNative || !device || !lowFpsAvailable) return;
    let cancelled = false;
    (async () => {
      try {
        const target = Math.max(1, appliedHz + fineOffset);
        const res = await Exposure.setTargetFps(target, true);
        if (cancelled) return;
        setNativeApplied(res);
        // find a matching VisionCamera format by width/height
        const match = (device.formats ?? []).find((f) => f.videoWidth === res.width && f.videoHeight === res.height);
        setNativeFormat(match ?? undefined);
      } catch (e) {
        console.error('Low-FPS native configuration failed', e);
      }
    })();
    return () => { cancelled = true };
  }, [lowFpsNative, appliedHz, fineOffset, device, lowFpsAvailable]);

  // Reset native low-FPS configuration when disabled
  useEffect(() => {
    if (lowFpsNative || !lowFpsAvailable) return;
    let cancelled = false;
    (async () => {
      try {
        await Exposure.resetFrameRate();
        if (cancelled) return;
        setNativeApplied(undefined);
        setNativeFormat(undefined);
      } catch (e) {
        console.warn('Low-FPS native reset failed', e);
      }
    })();
    return () => { cancelled = true };
  }, [lowFpsNative, lowFpsAvailable]);

  const handleBack = () => {
    setIsActive(false);
    router.back();
  };

  // Build slider stops from the actual format used by Camera (ensures every stop is supported by that format)
  const formatForStops = useMemo(() => (lowFpsNative ? (nativeFormat ?? lockedFormat ?? selectedFormat) : (lockedFormat ?? selectedFormat)), [lowFpsNative, nativeFormat, lockedFormat, selectedFormat]);
  const sliderOptions = useMemo(() => {
    const f = formatForStops as CameraDeviceFormat | undefined;
    if (f && typeof f.minFps === 'number' && typeof f.maxFps === 'number') {
      const min = Math.max(1, Math.ceil(f.minFps as number));
      const max = Math.max(min, Math.floor(f.maxFps as number));
      const arr: number[] = [];
      for (let v = min; v <= max; v++) arr.push(v);
      return arr;
    }
    const list = (supportedFpsOptions || []).slice().sort((a, b) => a - b);
    return list.length ? list : [requestedHz];
  }, [formatForStops, supportedFpsOptions, requestedHz]);
  const sliderIndex = useMemo(() => {
    if (!sliderOptions.length) return 0;
    const idx = sliderOptions.reduce((bestIdx, val, idx) => {
      return Math.abs(val - requestedHz) < Math.abs(sliderOptions[bestIdx] - requestedHz) ? idx : bestIdx;
    }, 0);
    return idx;
  }, [sliderOptions, requestedHz]);

  const rpm = useMemo(() => {
    const hzVal = Number.isFinite(effectiveFps) ? effectiveFps : appliedHz;
    return hzVal * 60; // divisor fixed to 1
  }, [effectiveFps, appliedHz]);

  // Debounce applying requestedHz to the camera (snap to nearest supported option from the active Camera format)
  useEffect(() => {
    if (driftMode && !lowFpsNative) return; // drift loop controls appliedHz
    const t = setTimeout(() => {
      const options = (sliderOptions && sliderOptions.length) ? sliderOptions : [requestedHz];
      const nearest = options.reduce((p, c) => (Math.abs(c - requestedHz) < Math.abs(p - requestedHz) ? c : p), options[0]);
      if (nearest !== appliedHz) setAppliedHz(nearest);
    }, 500);
    return () => clearTimeout(t);
  }, [requestedHz, sliderOptions, appliedHz, driftMode, lowFpsNative]);

  // Drift mode: oscillate appliedHz between neighbor supported stops (every ~2s) to create slow movement when frozen
  useEffect(() => {
    if (!driftMode || lowFpsNative) return;
    if (!sliderOptions.length) return;
    let i = 0;
    const options = sliderOptions.slice().sort((a, b) => a - b);
    // find neighbors around requestedHz
    const idx = options.reduce((bestIdx, val, idx) => (Math.abs(val - requestedHz) < Math.abs(options[bestIdx] - requestedHz) ? idx : bestIdx), 0);
    const lower = Math.max(0, idx - 1);
    const upper = Math.min(options.length - 1, idx + 1);
    const seq = lower === upper ? [options[idx]] : [options[lower], options[upper]];
    const interval = setInterval(() => {
      const next = seq[i % seq.length];
      i++;
      if (next !== appliedHz) setAppliedHz(next);
    }, 2000);
    return () => clearInterval(interval);
  }, [driftMode, lowFpsNative, sliderOptions, requestedHz, appliedHz]);

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
      <VisionCameraView
        remounting={false}
        cameraKey={cameraKey}
        cameraRef={cameraRef}
        device={device}
        isActive={isActive}
        cameraFps={cameraFpsProp}
        selectedFormat={lowFpsNative ? (nativeFormat ?? lockedFormat ?? selectedFormat) : (lockedFormat ?? selectedFormat)}
        torch={torch}
        onInitialized={() => {}}
      />

      {/* Middle readouts */}
      <View style={styles.centerPanel}>
        <Text style={styles.hzReadout}>{(effectiveFps ?? appliedHz).toFixed(2)} <Text style={{ fontSize: 18 }}>Hz</Text></Text>
        <Text style={styles.hzSubLabel}>Req: {requestedHz.toFixed(2)} Hz • Eff: {(effectiveFps ?? appliedHz).toFixed(2)} Hz</Text>
        {lowFpsNative && nativeApplied && (
          <Text style={styles.hzSubLabel}>
            Native: {nativeApplied.appliedFps.toFixed(2)} Hz @ {nativeApplied.width}x{nativeApplied.height}
          </Text>
        )}
        <Text style={styles.rpmText}>RPM: {rpm.toFixed(0)}</Text>
      </View>

      {/* Bottom slider with discrete supported stops */}
      {sliderOptions.length > 0 && (
        <View style={[styles.sliderContainer, { bottom: 56 + insets.bottom }]}>
          <Text style={styles.sliderLabel}>Adjust Hz</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={Math.max(0, sliderOptions.length - 1)}
            step={1}
            value={sliderIndex}
            minimumTrackTintColor="#ffffff"
            maximumTrackTintColor="rgba(255,255,255,0.25)"
            onValueChange={(val) => {
              const idx = Math.round(val);
              const next = sliderOptions[idx] ?? sliderOptions[sliderOptions.length - 1];
              setRequestedHz(next);
            }}
            onSlidingComplete={(val) => {
              const idx = Math.round(val);
              const next = sliderOptions[idx] ?? sliderOptions[sliderOptions.length - 1];
              setRequestedHz(next);
            }}
          />
          <Text style={styles.sliderValue}>{requestedHz.toFixed(2)} Hz</Text>
        </View>
      )}

      {/* Fine detune (native-only) to create slow drift when frozen */}
      {Platform.OS === 'ios' && lowFpsAvailable && lowFpsNative && (
        <View style={[styles.sliderContainer, { bottom: 120 + insets.bottom }]}> 
          <Text style={styles.sliderLabel}>Fine Detune (±0.5 Hz)</Text>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={-0.5}
            maximumValue={0.5}
            step={0.01}
            value={fineOffset}
            minimumTrackTintColor="#ffffff"
            maximumTrackTintColor="rgba(255,255,255,0.25)"
            onValueChange={(val) => setFineOffset(val)}
          />
          <Text style={styles.sliderValue}>{fineOffset.toFixed(2)} Hz offset</Text>
        </View>
      )}

      {/* Bottom bar: modes, torch, back */}
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.bottomButton, !lowFpsAvailable && { opacity: 0.5 }]}
            onPress={() => {
              if (!lowFpsAvailable) return; // ignore when not linked
              setLowFpsNative((v) => !v);
            }}
            disabled={!lowFpsAvailable}
          >
            <Text style={styles.bottomButtonText}>
              {lowFpsAvailable ? (lowFpsNative ? 'Low-FPS: On' : 'Low-FPS: Off') : 'Low-FPS: Unavailable'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.bottomButton} onPress={() => setDriftMode((v) => !v)}>
          <Text style={styles.bottomButtonText}>{driftMode ? 'Drift: On' : 'Drift: Off'}</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.bottomButton} onPress={() => setSafeModeIOS((v) => !v)}>
            <Text style={styles.bottomButtonText}>{safeModeIOS ? 'iOS Safe: On' : 'iOS Safe: Off'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.bottomButton} onPress={() => setTorch((t) => (t === 'on' ? 'off' : 'on'))}>
          <Text style={styles.bottomButtonText}>{torch === 'on' ? 'Torch On' : 'Torch Off'}</Text>
        </TouchableOpacity>
        <BackButton onPress={handleBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '30%',
    alignItems: 'center',
  },
  hzReadout: {
    color: 'white',
    fontWeight: '800',
    fontSize: 42,
  },
  hzSubLabel: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontSize: 12,
  },
  rpmText: { color: 'white', marginTop: 10, fontSize: 18, fontWeight: '700' },
  sliderContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sliderLabel: { color: 'white', fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  sliderValue: { color: 'white', fontWeight: '600', marginTop: 6, textAlign: 'center' },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bottomButtonText: { color: 'white', fontWeight: '700' },
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
