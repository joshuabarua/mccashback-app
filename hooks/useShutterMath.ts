import { useCallback, useMemo } from 'react';

export type ExposureMode = 'auto' | 'manual';

export function formatShutterLabel(exposureMode: ExposureMode, currentShutterNs: number | null): string {
  if (exposureMode === 'auto' || !currentShutterNs) return 'Auto Shutter';
  const seconds = currentShutterNs / 1e9;
  if (seconds >= 0.5) return `${seconds.toFixed(1)}s`;
  const denom = Math.round(1 / seconds);
  return `1/${denom}s`;
}

export function useShutterMath(effectiveFps?: number | null, fps?: number | null) {
  const baseFps = effectiveFps || fps || 30;
  const maxSeconds = useMemo(() => 1 / baseFps, [baseFps]);
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

  return { minSeconds, maxSeconds, sliderValueFromNs, nsFromSliderValue };
}
