import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export type ControlsOverlayProps = {
  insetsBottom: number;
  isRecording: boolean;
  isConfiguring: boolean;
  shutterLabel: string;
  onRecordPress: () => void;
  onShutterPress: () => void;
  shutterDisabled?: boolean;
};

export default function ControlsOverlay({
  insetsBottom,
  isRecording,
  isConfiguring,
  shutterLabel,
  onRecordPress,
  onShutterPress,
  shutterDisabled,
}: ControlsOverlayProps) {
  return (
    <BlurView intensity={20} tint="dark" style={[styles.controlsOverlay, { paddingBottom: 20 + insetsBottom }]}>
      <View style={styles.iconRow}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            { backgroundColor: isRecording ? '#ff4d4d' : 'rgba(255, 255, 255, 0.2)', opacity: isConfiguring ? 0.5 : 1 },
          ]}
          disabled={isConfiguring}
          onPress={onRecordPress}
        >
          <Ionicons name={isRecording ? 'stop' : 'radio-button-on'} size={24} color={isRecording ? 'white' : '#ff4d4d'} />
        </TouchableOpacity>

        <View style={styles.iconGroup}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              { opacity: isConfiguring || isRecording || shutterDisabled ? 0.35 : 1 },
            ]}
            disabled={isConfiguring || isRecording || !!shutterDisabled}
            onPress={onShutterPress}
          >
            <Ionicons name="aperture" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.iconSubLabel}>{shutterDisabled ? 'Not supported' : (isConfiguring ? 'Configuring…' : shutterLabel)}</Text>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 30,
    paddingBottom: 50,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 30,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  iconGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSubLabel: {
    marginTop: 6,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
});
