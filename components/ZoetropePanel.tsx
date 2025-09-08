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
  torchStrobeEnabled: boolean;
  setTorchStrobeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  framesPerRev: number;
  setFramesPerRev: React.Dispatch<React.SetStateAction<number>>;
  harmonic: number;
  setHarmonic: React.Dispatch<React.SetStateAction<number>>;
  imuTachEnabled: boolean;
  setImuTachEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  imuRpmRounded?: number;
  onMarkPass: () => void;
  manualRpmRounded?: number;
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
    torchStrobeEnabled,
    setTorchStrobeEnabled,
    framesPerRev,
    setFramesPerRev,
    harmonic,
    setHarmonic,
    imuTachEnabled,
    setImuTachEnabled,
    imuRpmRounded,
    onMarkPass,
    manualRpmRounded,
  } = props;

  const formattedTick = () => formatPresetTick(targetRpm, rpmPresets, snapWindow);

  const fprOptions = [6, 8, 9, 10, 12, 16, 24];
  const nextFrom = (arr: number[], cur: number) => {
    const idx = arr.indexOf(cur);
    const next = idx >= 0 ? arr[(idx + 1) % arr.length] : arr[0];
    return next;
  };

  return (
    <View style={[styles.shutterPanel, { bottom }]}> 
      {/* Controls row: wraps on small screens */}
      <View style={[styles.shutterRow, { marginTop: 10, gap: 8, flexWrap: 'wrap' }]}> 
        <TouchableOpacity
          style={[styles.shutterButton, { backgroundColor: imuTachEnabled ? 'rgba(165,212,165,0.35)' : 'rgba(255,255,255,0.15)' }]}
          onPress={() => setImuTachEnabled((p) => !p)}
        >
          <Text style={styles.shutterButtonText}>{imuTachEnabled ? 'IMU Tach: On' : 'IMU Tach: Off'}</Text>
        </TouchableOpacity>
        {!!imuTachEnabled && (
          <Text style={[styles.shutterTick, { width: undefined }]}>{`~${imuRpmRounded ?? 0} RPM`}</Text>
        )}
        {enableStrobeOverlay && (
          <TouchableOpacity
            style={[styles.shutterButton, { backgroundColor: visualStrobeEnabled ? 'rgba(165,212,165,0.35)' : 'rgba(255,255,255,0.15)' }]}
            onPress={() => setVisualStrobeEnabled((p) => !p)}
          >
            <Text style={styles.shutterButtonText}>{visualStrobeEnabled ? 'Flash UI: On' : 'Flash UI: Off'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.shutterButton, { backgroundColor: torchStrobeEnabled ? 'rgba(165,212,165,0.35)' : 'rgba(255,255,255,0.15)' }]}
          onPress={() => setTorchStrobeEnabled((p) => !p)}
        >
          <Text style={styles.shutterButtonText}>{torchStrobeEnabled ? 'Torch Strobe: On' : 'Torch Strobe: Off'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shutterButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={onMarkPass}
        >
          <Text style={styles.shutterButtonText}>Mark Pass</Text>
        </TouchableOpacity>
        {!!manualRpmRounded && (
          <Text style={[styles.shutterTick, { width: undefined }]}>{`~${manualRpmRounded} RPM`}</Text>
        )}
        <TouchableOpacity
          style={[styles.shutterButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => setFramesPerRev((cur) => nextFrom(fprOptions, cur))}
        >
          <Text style={styles.shutterButtonText}>{`FPR: ${framesPerRev}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shutterButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => setHarmonic((cur) => (cur >= 8 ? 1 : cur + 1))}
        >
          <Text style={styles.shutterButtonText}>{`m: ${harmonic}`}</Text>
        </TouchableOpacity>
      </View>
      {/* Slider row: full width */}
      <View style={[styles.shutterRow, { marginTop: 8, alignItems: 'center' }]}> 
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
          style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, marginHorizontal: 8 }}
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
    width: 60,
    textAlign: 'center',
  },
});
