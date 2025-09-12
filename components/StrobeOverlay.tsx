import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStrobeOverlay } from '../hooks/useStrobeOverlay';

export type StrobeOverlayProps = {
  enabled: boolean;
  strobeHz: number;
  maxDisplayHz?: number;
  dutyCycle?: number; // fraction [0..1] visible each cycle
  style?: any;
};

export default function StrobeOverlay({ enabled, strobeHz, maxDisplayHz = 15, dutyCycle = 0.15, style }: StrobeOverlayProps) {
  const { strobeStyle } = useStrobeOverlay({ enabled, strobeHz, maxDisplayHz, dutyCycle });
  if (!enabled) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black' }, style, strobeStyle]}
    />
  );
}
