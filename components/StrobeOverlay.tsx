import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStrobeOverlay } from '../hooks/useStrobeOverlay';

export type StrobeOverlayProps = {
  enabled: boolean;
  strobeHz: number;
  maxDisplayHz?: number;
  style?: any;
};

export default function StrobeOverlay({ enabled, strobeHz, maxDisplayHz = 15, style }: StrobeOverlayProps) {
  const { strobeStyle } = useStrobeOverlay({ enabled, strobeHz, maxDisplayHz });
  if (!enabled) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'white' }, style, strobeStyle]}
    />
  );
}
