import { useEffect } from 'react';
import { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export type UseStrobeOverlayParams = {
  enabled: boolean;
  strobeHz: number;
  maxDisplayHz?: number; // safety cap (default 15 Hz)
};

export function useStrobeOverlay({ enabled, strobeHz, maxDisplayHz = 15 }: UseStrobeOverlayParams) {
  const strobePhase = useSharedValue(0);

  const strobeStyle = useAnimatedStyle(() => {
    const phase = strobePhase.value % 1;
    const opacity = phase < 0.5 ? 0.9 : 0;
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
    const periodMs = Math.max(5, Math.round(1000 / f));
    strobePhase.value = 0;
    strobePhase.value = withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(strobePhase);
    };
  }, [enabled, strobeHz, maxDisplayHz, strobePhase]);

  return { strobeStyle };
}

// StrobeOverlay component moved to components/StrobeOverlay.tsx to keep this file JSX-free
