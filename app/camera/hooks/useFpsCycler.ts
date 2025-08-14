import { useCallback, useRef } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import type { Camera } from 'react-native-vision-camera';

export function useFpsCycler(params: {
  supportedFpsOptions: number[];
  fps: number;
  setFps: (v: number) => void;
  isRecording: boolean;
  isConfiguring: boolean;
  showToast: (msg: string) => void;
  cameraRef: RefObject<Camera | null>;
  pendingFpsRef: MutableRefObject<number | null>;
  pendingResumeRef: MutableRefObject<boolean>;
  prevFpsRef: MutableRefObject<number>;
}) {
  const {
    supportedFpsOptions,
    fps,
    setFps,
    isRecording,
    isConfiguring,
    showToast,
    cameraRef,
    pendingFpsRef,
    pendingResumeRef,
    prevFpsRef,
  } = params;

  const lastFpsTapRef = useRef(0);

  const cycleFps = useCallback(() => {
    const now = Date.now();
    if (now - lastFpsTapRef.current < 250) return; // debounce
    lastFpsTapRef.current = now;

    const options = supportedFpsOptions;
    if (!options.length) return;
    if (pendingFpsRef.current != null) return; // already changing

    let idx = options.findIndex((v) => v === fps);
    if (idx === -1) {
      const nearest = options.reduce((prev, curr) => (Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev), options[0]);
      idx = options.indexOf(nearest);
    }
    const next = options[(idx + 1) % options.length];

    if (isRecording) {
      pendingFpsRef.current = next;
      prevFpsRef.current = fps;
      pendingResumeRef.current = true;
      if (!isConfiguring) {
        // slight delay to let UI draw toast nicely
        setTimeout(() => showToast('Pausing recording while changing FPS…'), 50);
      }
      try { cameraRef.current?.stopRecording(); } catch {}
      return;
    }

    prevFpsRef.current = fps;
    setFps(next);
  }, [supportedFpsOptions, fps, isRecording, isConfiguring, showToast, cameraRef, pendingFpsRef, pendingResumeRef, prevFpsRef, setFps]);

  return { cycleFps };
}
