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

const TARGET_AREA_1080P = 1920 * 1080;

export const SAFE_IOS_FPS_OPTIONS = [16, 24, 25, 30, 50, 60, 120, 240];

export function formatArea(f: CameraDeviceFormat): number {
  return (Number(f.videoWidth) || 0) * (Number(f.videoHeight) || 0);
}

export function supportsTargetFps(
  f: CameraDeviceFormat,
  v: number,
  platform: typeof Platform.OS = Platform.OS,
): boolean {
  const min = f.minFps!;
  const max = f.maxFps!;
  if (platform === 'ios') {
    if (v === 24) {
      // tolerate cinema 23.976 ≈ 24
      return min <= 24.5 && max >= 23.5;
    }
    if (v === 30) {
      return min <= 30.5 && max >= 29.5; // tolerate NTSC 29.97 ≈ 30
    }
    if (v === 60) {
      return min <= 60.5 && max >= 59.0; // tolerate NTSC 59.94 ≈ 60
    }
  }
  return min <= v && max >= v;
}

// fallow-ignore-next-line complexity
export function selectBestFormat(
  device: CameraDevice,
  fps: number,
  qualityFirst: boolean,
): CameraDeviceFormat | undefined {
  const formats: CameraDeviceFormat[] = device.formats ?? [];
  const withFps = formats.filter((f) => typeof f.minFps === 'number' && typeof f.maxFps === 'number');
  const area = formatArea;
  const targetArea = TARGET_AREA_1080P;

  let candidates = withFps.filter((f) => supportsTargetFps(f, fps));
  if (fps <= 60) {
    const nonHfr = candidates.filter((f) => (f.maxFps || 0) <= 60);
    if (nonHfr.length) candidates = nonHfr;
  }

  if (candidates.length > 0) {
    if (qualityFirst) {
      // Prefer the highest resolution format that supports the target fps
      return candidates.sort((a, b) => area(b) - area(a))[0];
    }
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
}

export function getDeviceFpsRange(device: CameraDevice | undefined): { min: number; max: number } {
  if (!device) return { min: 15, max: 60 };
  const formats: CameraDeviceFormat[] = device.formats ?? [];
  const mins = formats.map((f) => f.minFps).filter((n): n is number => Number.isFinite(n as number));
  const maxs = formats.map((f) => f.maxFps).filter((n): n is number => Number.isFinite(n as number));
  return {
    min: mins.length ? Math.min(...mins) : 15,
    max: maxs.length ? Math.max(...maxs) : 60,
  };
}

export function getSupportedFpsOptions(
  f: CameraDeviceFormat,
  fps: number,
  extended: boolean,
  platform: typeof Platform.OS = Platform.OS,
): number[] {
  const min = Math.max(1, Math.ceil(f.minFps ?? 1));
  const max = Math.max(min, Math.floor(f.maxFps ?? 60));

  if (platform === 'ios') {
    if (extended) {
      const values: number[] = [];
      for (let v = min; v <= max; v++) values.push(v);
      return values.length ? values : [Math.min(30, max)];
    }
    const within = SAFE_IOS_FPS_OPTIONS.filter((v) => v >= min && v <= max);
    return within.length ? within : [Math.min(30, max)];
  }

  // Android: expose dense integers within the current format
  const values: number[] = [];
  for (let v = min; v <= max; v++) values.push(v);
  return values.length ? values : [30];
}

export function clampFps(min: number, max: number, fps: number): number {
  return Math.max(min, Math.min(max, fps));
}

export function findNearestOption(options: number[], fps: number): number {
  return options.reduce((prev, curr) => (Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev), options[0]);
}

export function useFormatsAndFps(
  device: CameraDevice | undefined,
  fps: number,
  setFps: (v: number) => void,
  qualityFirst: boolean = false,
  extended: boolean = false,
): FormatsAndFps {
  const selectedFormat = useMemo(() => (device ? selectBestFormat(device, fps, qualityFirst) : undefined), [device, fps, qualityFirst]);

  const deviceFpsRange = useMemo(() => getDeviceFpsRange(device), [device]);

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

  const effectiveFps = useMemo(() => clampFps(currentFpsRange.min, currentFpsRange.max, fps), [currentFpsRange, fps]);

  const cameraFps = useMemo(() => {
    // On iOS, for 24/30/60 allow AVFoundation to pick the closest stable rate (23.976/29.97/59.94)
    if (Platform.OS === 'ios' && (fps === 24 || fps === 30 || fps === 60)) return undefined;
    return effectiveFps;
  }, [fps, effectiveFps]);

  const supportedFpsOptions = useMemo(
    () => (selectedFormat ? getSupportedFpsOptions(selectedFormat, fps, extended) : [fps]),
    [selectedFormat, fps, extended],
  );

  // Ensure current fps is always a supported option
  useEffect(() => {
    if (!supportedFpsOptions.length) return;
    if (!supportedFpsOptions.includes(fps)) {
      setFps(findNearestOption(supportedFpsOptions, fps));
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
