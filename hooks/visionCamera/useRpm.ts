import { useMemo } from 'react';

export function useRpm(effectiveFps: number, appliedHz: number) {
  return useMemo(() => {
    const hzVal = Number.isFinite(effectiveFps) ? effectiveFps : appliedHz;
    return hzVal * 60;
  }, [effectiveFps, appliedHz]);
}
