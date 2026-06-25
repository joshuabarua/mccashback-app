import { useMemo } from 'react';
import type { CameraDeviceFormat } from 'react-native-vision-camera';

export function useSliderOptions(
  lockedFormat: CameraDeviceFormat | undefined,
  selectedFormat: CameraDeviceFormat | undefined,
  requestedHz: number,
) {
  const formatForStops = useMemo(() => (lockedFormat ?? selectedFormat), [lockedFormat, selectedFormat]);

  // fallow-ignore-next-line complexity
  const sliderOptions = useMemo(() => {
    const f = formatForStops as CameraDeviceFormat | undefined;
    if (f && typeof f.minFps === 'number' && typeof f.maxFps === 'number') {
      const minHz = Math.max(1, f.minFps as number);
      const maxHz = Math.max(minHz, f.maxFps as number);
      const minRPM = Math.ceil((minHz * 60) / 10) * 10;
      const maxRPM = Math.floor((maxHz * 60) / 10) * 10;
      const arr: number[] = [];
      for (let rpm = minRPM; rpm <= maxRPM; rpm += 10) {
        arr.push(rpm / 60);
      }
      return arr.length ? arr : [requestedHz];
    }
    const baseRPM = Math.round((requestedHz || 30) * 60);
    const arr: number[] = [];
    for (let rpm = baseRPM - 30; rpm <= baseRPM + 30; rpm += 10) arr.push(rpm / 60);
    return arr;
  }, [formatForStops, requestedHz]);

  const sliderIndex = useMemo(() => {
    if (!sliderOptions.length) return 0;
    return sliderOptions.reduce((bestIdx, val, idx) => {
      return Math.abs(val - requestedHz) < Math.abs(sliderOptions[bestIdx] - requestedHz) ? idx : bestIdx;
    }, 0);
  }, [sliderOptions, requestedHz]);

  return { sliderOptions, sliderIndex };
}
