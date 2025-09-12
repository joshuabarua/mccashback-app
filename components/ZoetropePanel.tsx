import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';

export type ZoetropePanelProps = {
  bottom: number;
  fps: number;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  fpsOptions: number[];
  effectiveFps?: number;
};

export default function ZoetropePanel(props: ZoetropePanelProps) {
  const { bottom, fps, setFps, fpsOptions, effectiveFps } = props;

  // Debounced FPS slider value (avoid reconfiguring camera on every tick)
  const [tempFps, setTempFps] = useState<number | null>(null);
  const displayFps = tempFps ?? fps;

  // Update RPM live as the user drags for immediate feedback

  const fpsMin = useMemo(() => (fpsOptions && fpsOptions.length ? fpsOptions[0] : 30), [fpsOptions]);
  const fpsMax = useMemo(() => (fpsOptions && fpsOptions.length ? fpsOptions[fpsOptions.length - 1] : 60), [fpsOptions]);

  // Press-and-hold repeat for +/- buttons
  const decTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [repeatIntervalMs] = useState<number>(200);
  const stepDown = () => {
    if (!fpsOptions?.length) return;
    const idx = fpsOptions.indexOf(fps);
    const next = idx > 0 ? fpsOptions[idx - 1] : fpsOptions[0];
    setFps(next);
  };
  const stepUp = () => {
    if (!fpsOptions?.length) return;
    const idx = fpsOptions.indexOf(fps);
    const next = idx >= 0 && idx < fpsOptions.length - 1 ? fpsOptions[idx + 1] : fpsOptions[fpsOptions.length - 1];
    setFps(next);
  };
  const startDecRepeat = () => {
    stepDown();
    if (decTimerRef.current) clearInterval(decTimerRef.current);
    decTimerRef.current = setInterval(stepDown, Math.max(60, repeatIntervalMs));
  };
  const stopDecRepeat = () => {
    if (decTimerRef.current) { clearInterval(decTimerRef.current); decTimerRef.current = null; }
  };
  const startIncRepeat = () => {
    stepUp();
    if (incTimerRef.current) clearInterval(incTimerRef.current);
    incTimerRef.current = setInterval(stepUp, Math.max(60, repeatIntervalMs));
  };
  const stopIncRepeat = () => {
    if (incTimerRef.current) { clearInterval(incTimerRef.current); incTimerRef.current = null; }
  };

  return (
    <View style={[styles.shutterPanel, { bottom }]}> 
      {/* Controls row: wraps on small screens */}
      <View style={[styles.shutterRow, { marginTop: 10, gap: 8, flexWrap: 'wrap' }]}> 
        {/* Camera FPS controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={[styles.shutterButton]}
            onPress={() => {
              if (!fpsOptions?.length) return;
              setFps(fpsOptions[0]);
            }}
          >
            <Text style={styles.shutterButtonText}>MIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shutterButton]}
            onPress={stepDown}
            onPressIn={startDecRepeat}
            onPressOut={stopDecRepeat}
            onLongPress={() => {}}
            delayLongPress={150}
          >
            <Text style={styles.shutterButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.shutterTick, { width: undefined }]}>{`${effectiveFps ?? fps} Hz`}</Text>
          <TouchableOpacity
            style={[styles.shutterButton]}
            onPress={stepUp}
            onPressIn={startIncRepeat}
            onPressOut={stopIncRepeat}
            onLongPress={() => {}}
            delayLongPress={150}
          >
            <Text style={styles.shutterButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shutterButton]}
            onPress={() => {
              if (!fpsOptions?.length) return;
              setFps(fpsOptions[fpsOptions.length - 1]);
            }}
          >
            <Text style={styles.shutterButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Slider row: full width */}
      <View style={[styles.shutterRow, { marginTop: 8, alignItems: 'center' }]}> 
        <Text style={styles.shutterTick}>Hz</Text>
        <Slider
          value={displayFps}
          minimumValue={fpsMin}
          maximumValue={fpsMax}
          step={1}
          onValueChange={(val) => {
            const n = Array.isArray(val) ? (val[0] as number) : (val as number);
            if (!fpsOptions?.length) return;
            const nearest = fpsOptions.reduce((prev, curr) => (Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev), fpsOptions[0]);
            setTempFps(nearest);
          }}
          onSlidingComplete={(val) => {
            const n = Array.isArray(val) ? (val[0] as number) : (val as number);
            if (!fpsOptions?.length) return;
            const nearest = fpsOptions.reduce((prev, curr) => (Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev), fpsOptions[0]);
            setFps(nearest);
            setTempFps(null);
          }}
          minimumTrackTintColor="#a5d4a5"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          thumbTintColor="#a5d4a5"
          style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, marginHorizontal: 8 }}
        />
        <Text style={styles.shutterTick}>{`${effectiveFps ?? fps} Hz`}</Text>
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
