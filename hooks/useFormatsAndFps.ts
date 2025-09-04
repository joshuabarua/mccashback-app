import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';

export type FormatsAndFps = {
  selectedFormat: CameraDeviceFormat | undefined;
  currentFpsRange: { min: number; max: number };
  effectiveFps: number;
  cameraFps: number | undefined;
  supportedFpsOptions: number[];
  deviceMaxFps: number;
};

export function useFormatsAndFps(
  device: CameraDevice | undefined,
  fps: number,
  setFps: (v: number) => void,
): FormatsAndFps {
  const selectedFormat = useMemo(() => {
    if (!device) return undefined;
    const formats: CameraDeviceFormat[] = device.formats ?? [];
    const withFps = formats.filter((f) => typeof f.minFps === 'number' && typeof f.maxFps === 'number');
    const area = (f: CameraDeviceFormat) => (Number(f.videoWidth) || 0) * (Number(f.videoHeight) || 0);
    const targetArea = 1920 * 1080;
    const supportsTarget = (f: CameraDeviceFormat, v: number) => {
      const min = f.minFps!;
      const max = f.maxFps!;
      if (Platform.OS === 'ios') {
        if (v === 30) {
          return min <= 30.5 && max >= 29.5; // tolerate NTSC 29.97 ≈ 30
        }
        if (v === 60) {
          return min <= 60.5 && max >= 59.0; // tolerate NTSC 59.94 ≈ 60
        }
      }
      return min <= v && max >= v;
    };
    let candidates = withFps.filter((f) => supportsTarget(f, fps));
    if (fps <= 60) {
      const nonHfr = candidates.filter((f) => (f.maxFps || 0) <= 60);
      if (nonHfr.length) candidates = nonHfr;
    }
    if (candidates.length > 0) {
      const aboveOrEqual = candidates.filter((f) => area(f) >= targetArea).sort((a, b) => area(a) - area(b));
      if (aboveOrEqual.length) return aboveOrEqual[0];
      return candidates.sort((a, b) => area(b) - area(a))[0];
    }
    // Fallback: closest fps range and resolution closeness to 1080p
    let best: CameraDeviceFormat | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const f of withFps) {
      const deltaFps = fps < f.minFps! ? f.minFps! - fps : fps > f.maxFps! ? fps - f.maxFps! : 0;
      const deltaArea = Math.abs(area(f) - targetArea) / targetArea;
      const score = deltaFps + deltaArea;
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  }, [device, fps]);

  const deviceFpsRange = useMemo(() => {
    if (!device) return { min: 15, max: 60 };
    const formats: CameraDeviceFormat[] = device.formats ?? [];
    const mins = formats.map((f) => f.minFps).filter((n): n is number => Number.isFinite(n as number));
    const maxs = formats.map((f) => f.maxFps).filter((n): n is number => Number.isFinite(n as number));
    return {
      min: mins.length ? Math.min(...mins) : 15,
      max: maxs.length ? Math.max(...maxs) : 60,
    };
  }, [device]);

  const currentFpsRange = useMemo(() => {
    if (selectedFormat && typeof selectedFormat.minFps === 'number' && typeof selectedFormat.maxFps === 'number') {
      return { min: selectedFormat.minFps, max: selectedFormat.maxFps };
    }
    return deviceFpsRange;
  }, [selectedFormat, deviceFpsRange]);

  // Keep fps within the current supported range
  useEffect(() => {
    const { min, max } = currentFpsRange;
    if (fps < min) setFps(min);
    else if (fps > max) setFps(max);
  }, [currentFpsRange, fps, setFps]);

  const effectiveFps = useMemo(() => {
    const { min, max } = currentFpsRange;
    return Math.max(min, Math.min(max, fps));
  }, [currentFpsRange, fps]);

  const cameraFps = useMemo(() => {
    if (Platform.OS === 'ios' && (fps === 30 || fps === 60)) return undefined;
    return effectiveFps;
  }, [fps, effectiveFps]);

  const supportedFpsOptions = useMemo(() => {
    if (!device) return [30];
    const formats: CameraDeviceFormat[] = device.formats ?? [];
    const candidateSet = new Set<number>([24, 30, 60, 120, 240]);
    for (const f of formats) {
      if (typeof f.minFps === 'number') candidateSet.add(Math.round(f.minFps));
      if (typeof f.maxFps === 'number') candidateSet.add(Math.round(f.maxFps));
    }
    const targetArea = 1920 * 1080;
    const supportsAt = (f: CameraDeviceFormat, v: number) => {
      if (typeof f.minFps !== 'number' || typeof f.maxFps !== 'number') return false;
      if (Platform.OS === 'ios') {
        if (v === 30) return f.minFps <= 30.5 && f.maxFps >= 29.5;
        if (v === 60) return f.minFps <= 60.5 && f.maxFps >= 59.0;
      }
      return f.minFps <= v && f.maxFps >= v;
    };
    const area = (f: CameraDeviceFormat) => (Number(f.videoWidth) || 0) * (Number(f.videoHeight) || 0);
    const supported = Array.from(candidateSet)
      .filter((v) => formats.some((f) => supportsAt(f, v)));
    const highQuality = supported.filter((v) => formats.some((f) => supportsAt(f, v) && area(f) >= targetArea));
    const values = (highQuality.length ? highQuality : supported)
      .sort((a, b) => a - b)
      .filter((v) => v !== 1 && (Platform.OS !== 'ios' || v !== 24));
    return values.length ? values : [30];
  }, [device]);

  // Ensure current fps is always a supported option
  useEffect(() => {
    const options = supportedFpsOptions;
    if (!options.length) return;
    if (!options.includes(fps)) {
      const nearest = options.reduce((prev, curr) => (Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev), options[0]);
      setFps(nearest);
    }
  }, [supportedFpsOptions, fps, setFps]);

  return {
    selectedFormat,
    currentFpsRange,
    effectiveFps,
    cameraFps,
    supportedFpsOptions,
    deviceMaxFps: deviceFpsRange.max,
  };
}
