import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { formatPresetTick, snapToPreset } from '../utils/zoetrope';

export type ZoetropePanelProps = {
  bottom: number;
  targetRpm: number;
  setTargetRpm: (v: number) => void;
  rpmPresets: readonly number[];
  rpmMin: number;
  rpmMax: number;
  snapWindow: number;
  enableStrobeOverlay: boolean;
  visualStrobeEnabled: boolean;
  setVisualStrobeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ZoetropePanel(props: ZoetropePanelProps) {
  const {
    bottom,
    targetRpm,
    setTargetRpm,
    rpmPresets,
    rpmMin,
    rpmMax,
    snapWindow,
    enableStrobeOverlay,
    visualStrobeEnabled,
    setVisualStrobeEnabled,
  } = props;

  const formattedTick = () => formatPresetTick(targetRpm, rpmPresets, snapWindow);

  return (
    <View style={[styles.shutterPanel, { bottom }]}> 
      <View style={[styles.shutterRow, { marginTop: 10 }]}> 
        {enableStrobeOverlay && (
          <TouchableOpacity
            style={[styles.shutterButton, { marginRight: 8, backgroundColor: visualStrobeEnabled ? 'rgba(165,212,165,0.35)' : 'rgba(255,255,255,0.15)' }]}
            onPress={() => setVisualStrobeEnabled((p) => !p)}
          >
            <Text style={styles.shutterButtonText}>{visualStrobeEnabled ? 'Flash UI: On' : 'Flash UI: Off'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.shutterTick}>RPM</Text>
        <Slider
          value={targetRpm}
          minimumValue={rpmMin}
          maximumValue={rpmMax}
          step={1}
          onValueChange={(val) => {
            const n = Array.isArray(val) ? (val[0] as number) : (val as number);
            const clamped = Math.max(rpmMin, Math.min(rpmMax, Math.round(n)));
            setTargetRpm(clamped);
          }}
          onSlidingComplete={(val) => {
            const n = Array.isArray(val) ? (val[0] as number) : (val as number);
            const snapped = snapToPreset(n, rpmPresets, snapWindow);
            setTargetRpm(snapped);
          }}
          minimumTrackTintColor="#a5d4a5"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor="#a5d4a5"
          style={{ flex: 1, marginHorizontal: 12 }}
        />
        <Text style={styles.shutterTick}>{formattedTick()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shutterPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shutterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  shutterTick: {
    color: 'white',
    fontVariant: ['tabular-nums'],
  },
});
