import React from 'react';
import { View, StyleSheet } from 'react-native';

export type Point = { x: number; y: number };
export type FocusOverlayProps = { point: Point | null };

export default function FocusOverlay({ point }: FocusOverlayProps) {
  if (!point) return null;
  return (
    <View
      style={[
        styles.focusIndicator,
        {
          left: point.x - 25,
          top: point.y - 25,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  focusIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#a5d4a5',
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
});
