import { useCallback, useRef, useState } from 'react';
import { useRunOnJS } from 'react-native-worklets-core';
import { useFrameProcessor } from 'react-native-vision-camera';

export type UseRpmEstimatorParams = {
  enabled: boolean;
  sampleRate: number; // effective FPS of sampling
  rpmMin: number;
  rpmMax: number;
  presets: readonly number[];
};

export function useRpmEstimator({ enabled, sampleRate, rpmMin, rpmMax, presets }: UseRpmEstimatorParams) {
  const [rpm, setRpm] = useState<number | null>(null);
  const [suggestionPreset, setSuggestionPreset] = useState<number | null>(null);

  const RN_THRESH = 0.35;
  const intensityBufferRef = useRef<number[]>([]);
  const rpmEmaRef = useRef<number | null>(null);
  const stableFramesRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);

  const onFrameSample = useCallback((avgIntensity: number) => {
    if (!enabled) return;
    const buf = intensityBufferRef.current;
    buf.push(avgIntensity);
    const maxLen = 512;
    if (buf.length > maxLen) buf.splice(0, buf.length - maxLen);
    const sr = sampleRate || 30;
    if (buf.length < Math.max(32, sr)) return; // need at least ~1s of data
    // Detrend
    const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
    const x = buf.map((v) => v - mean);
    const N = x.length;
    // Clamp lags to rpmMin..rpmMax
    const kMin = Math.max(2, Math.floor((sr * 60) / rpmMax));
    const kMax = Math.min(Math.floor(N / 2), Math.ceil((sr * 60) / rpmMin));
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
      const rawRpm = Math.max(rpmMin, Math.min(rpmMax, hz * 60));
      const alpha = 0.2; // EMA smoothing
      const prev = rpmEmaRef.current ?? rawRpm;
      const smoothed = prev + alpha * (rawRpm - prev);
      rpmEmaRef.current = smoothed;
      stableFramesRef.current += 1;
      if (stableFramesRef.current >= 3) {
        setRpm(smoothed);
        // Stable-match suggestion gating (>=1s within ±10 of a preset)
        let nearest: number = presets[0];
        let best = Math.abs(smoothed - nearest);
        for (const p of presets) {
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
  }, [enabled, sampleRate, rpmMin, rpmMax, presets]);

  const onFrameSampleJS = useRunOnJS(onFrameSample, [onFrameSample]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!enabled) return;
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
  }, [enabled, onFrameSampleJS]);

  return { rpm, suggestionPreset, setSuggestionPreset, frameProcessor } as const;
}
