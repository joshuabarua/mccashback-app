import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';

export type ShutterPanelProps = {
  bottom: number;
  shutterLabel: string;
  minSeconds: number;
  maxSeconds: number;
  currentShutterNs: number;
  sliderValueFromNs: (ns: number) => number;
  nsFromSliderValue: (t: number) => number;
  onValueChangeNs: (ns: number) => void;
  onSlidingCompleteNs: (ns: number) => void;
  onPreset180: () => void;
  onClose: () => void;
};

export default function ShutterPanel({
  bottom,
  shutterLabel,
  minSeconds,
  maxSeconds,
  currentShutterNs,
  sliderValueFromNs,
  nsFromSliderValue,
  onValueChangeNs,
  onSlidingCompleteNs,
  onPreset180,
  onClose,
}: ShutterPanelProps) {
  return (
    <View style={[styles.shutterPanel, { bottom }]}> 
      <Text style={styles.shutterBadge}>{shutterLabel}</Text>
      <View style={styles.shutterRow}>
        <Text style={styles.shutterTick}>{(() => {
          const s = minSeconds;
          return s >= 0.5 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}s`;
        })()}</Text>
        <Slider
          value={sliderValueFromNs(currentShutterNs)}
          minimumValue={0}
          maximumValue={1}
          onValueChange={(t) => onValueChangeNs(nsFromSliderValue(t))}
          onSlidingComplete={(t) => onSlidingCompleteNs(nsFromSliderValue(t))}
          minimumTrackTintColor="#a5d4a5"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor="#a5d4a5"
          style={{ flex: 1, marginHorizontal: 12 }}
        />
        <Text style={styles.shutterTick}>{(() => {
          const s = maxSeconds;
          return s >= 0.5 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}s`;
        })()}</Text>
      </View>
      <View style={styles.shutterButtons}>
        <TouchableOpacity style={styles.shutterButton} onPress={onPreset180}>
          <Text style={styles.shutterButtonText}>180°</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shutterButton} onPress={onClose}>
          <Text style={styles.shutterButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shutterPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shutterRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shutterTick: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    width: 60,
    textAlign: 'center',
  },
  shutterBadge: {
    alignSelf: 'center',
    color: 'white',
    fontWeight: '700',
  },
  shutterButtons: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shutterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  shutterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
