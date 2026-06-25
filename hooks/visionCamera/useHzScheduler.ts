import { useEffect } from 'react';

export function useHzScheduler(
  initialized: boolean,
  driftMode: boolean,
  requestedHz: number,
  appliedHz: number,
  sliderOptions: number[],
  setAppliedHz: (hz: number) => void,
) {
  // Debounce applying requestedHz to the nearest supported stop
  useEffect(() => {
    if (!initialized) return;
    if (driftMode) return;
    const t = setTimeout(() => {
      const options = sliderOptions && sliderOptions.length ? sliderOptions : [requestedHz];
      const nearest = options.reduce(
        (p, c) => (Math.abs(c - requestedHz) < Math.abs(p - requestedHz) ? c : p),
        options[0],
      );
      if (nearest !== appliedHz) setAppliedHz(nearest);
    }, 500);
    return () => clearTimeout(t);
  }, [initialized, requestedHz, sliderOptions, appliedHz, driftMode, setAppliedHz]);

  // Drift mode: oscillate between neighbouring stops
  // fallow-ignore-next-line complexity
  useEffect(() => {
    if (!initialized) return;
    if (!driftMode) return;
    if (!sliderOptions.length) return;
    let i = 0;
    const options = sliderOptions.slice().sort((a, b) => a - b);
    const idx = options.reduce(
      (bestIdx, val, idx) =>
        Math.abs(val - requestedHz) < Math.abs(options[bestIdx] - requestedHz) ? idx : bestIdx,
      0,
    );
    const lower = Math.max(0, idx - 1);
    const upper = Math.min(options.length - 1, idx + 1);
    const seq = lower === upper ? [options[idx]] : [options[lower], options[upper]];
    const interval = setInterval(() => {
      const next = seq[i % seq.length];
      i++;
      if (next !== appliedHz) setAppliedHz(next);
    }, 2000);
    return () => clearInterval(interval);
  }, [driftMode, sliderOptions, requestedHz, appliedHz, initialized, setAppliedHz]);
}
