import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type ToastOverlayProps = { message: string; bottom: number };

export default function ToastOverlay({ message, bottom }: ToastOverlayProps) {
  return (
    <View style={[styles.toast, { bottom }]} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    zIndex: 1100,
  },
  toastText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});
