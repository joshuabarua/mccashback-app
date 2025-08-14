import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';
import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';

export function useReconfiguration(params: {
  device: CameraDevice | undefined;
  fps: number;
  selectedFormat: CameraDeviceFormat | undefined;
  prevFpsRef: MutableRefObject<number>;
  setIsConfiguring: (v: boolean) => void;
  setRemounting: (v: boolean) => void;
  setIsActive: (v: boolean) => void;
  cameraReadyRef: MutableRefObject<boolean>;
}) {
  const {
    device,
    fps,
    selectedFormat,
    prevFpsRef,
    setIsConfiguring,
    setRemounting,
    setIsActive,
    cameraReadyRef,
  } = params;

  const reconfigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!device) return;
    setIsConfiguring(true);
    if (reconfigTimeoutRef.current) clearTimeout(reconfigTimeoutRef.current);
    cameraReadyRef.current = false; // will be flipped in onInitialized
    const settleMs = Platform.OS === 'ios' ? 2000 : 900;
    reconfigTimeoutRef.current = setTimeout(() => {
      setIsConfiguring(false);
    }, settleMs);

    if (Platform.OS === 'ios') {
      const fromHighSpeed = prevFpsRef.current >= 120;
      const toLow30 = fps === 30;
      if (fromHighSpeed && toLow30) {
        // Force unmount/remount to avoid black screen
        setRemounting(true);
        setIsActive(false);
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        if (remountTimeoutRef.current) clearTimeout(remountTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          setIsActive(true);
        }, 300);
        remountTimeoutRef.current = setTimeout(() => {
          setRemounting(false);
        }, 400);
      }
    }

    // update prev for next transition heuristics
    prevFpsRef.current = fps;

    return () => {
      if (reconfigTimeoutRef.current) {
        clearTimeout(reconfigTimeoutRef.current);
        reconfigTimeoutRef.current = null;
      }
    };
  }, [device, fps, selectedFormat, setIsActive, setIsConfiguring, setRemounting, cameraReadyRef, prevFpsRef]);
}
