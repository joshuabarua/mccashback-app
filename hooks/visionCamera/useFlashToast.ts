import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

export function useFlashToast(initialized: boolean) {
  const [showFlashToast, setShowFlashToast] = useState(false);
  const flashToastOpacity = useRef(new Animated.Value(0)).current;
  const flashToastShownRef = useRef(false);

  useEffect(() => {
    if (!initialized) return;
    if (flashToastShownRef.current) return;
    flashToastShownRef.current = true;
    setShowFlashToast(true);
    flashToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashToastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(flashToastOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setShowFlashToast(false));
  }, [initialized, flashToastOpacity]);

  return { showFlashToast, flashToastOpacity };
}
