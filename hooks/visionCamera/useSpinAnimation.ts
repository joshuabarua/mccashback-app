import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function useSpinAnimation(initialized: boolean) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = useMemo(
    () =>
      spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [spinValue],
  );
  useEffect(() => {
    if (!initialized) {
      const loop = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => {
        loop.stop();
        spinValue.setValue(0);
      };
    }
    spinValue.setValue(0);
  }, [initialized, spinValue]);
  return spin;
}
