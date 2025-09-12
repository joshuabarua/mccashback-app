import { useEffect } from 'react';
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export type UseStrobeOverlayParams = {
  enabled: boolean;
  strobeHz: number;
  maxDisplayHz?: number;
  dutyCycle?: number; // fraction [0..1] of each cycle that preview is visible
};

export function useStrobeOverlay({ enabled, strobeHz, maxDisplayHz = 15, dutyCycle = 0.15 }: UseStrobeOverlayParams) {
  const strobePhase = useSharedValue(0);

  const strobeStyle = useAnimatedStyle(() => {
    const phase = strobePhase.value % 1;
    // Black overlay fully opaque except during a short visible window each cycle
    const onWindow = Math.max(0.02, Math.min(0.95, dutyCycle));
    const opacity = phase < onWindow ? 0 : 1;
    return { opacity } as const;
  });

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(strobePhase);
      strobePhase.value = 0;
      return;
    }
    const f = Math.max(0.1, Math.min(maxDisplayHz, isFinite(strobeHz) ? strobeHz : 0));
    if (!(f > 0)) {
      cancelAnimation(strobePhase);
      strobePhase.value = 0;
      return;
    }
    const periodMs = Math.max(2, Math.round(1000 / f));
    strobePhase.value = 0;
    strobePhase.value = withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(strobePhase);
    };
  }, [enabled, strobeHz, maxDisplayHz, dutyCycle, strobePhase]);

  return { strobeStyle };
}

