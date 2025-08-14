import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

export function useFpsCycler(params: {
  supportedFpsOptions: number[];
  fps: number;
  setFps: (v: number) => void;
  isRecording: boolean;
  showToast: (msg: string) => void;
  pendingFpsRef: MutableRefObject<number | null>;
  prevFpsRef: MutableRefObject<number>;
}) {
  const {
    supportedFpsOptions,
    fps,
    setFps,
    isRecording,
    showToast,
    pendingFpsRef,
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

    if (isRecording) {
      // Disable FPS changes while recording to avoid AVFoundation errors
      showToast('Stop recording to change FPS');
      return;
    }

    let idx = options.findIndex((v) => v === fps);
    if (idx === -1) {
      const nearest = options.reduce((prev, curr) => (Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev), options[0]);
      idx = options.indexOf(nearest);
    }
    const next = options[(idx + 1) % options.length];

    prevFpsRef.current = fps;
    setFps(next);
  }, [supportedFpsOptions, fps, isRecording, showToast, pendingFpsRef, prevFpsRef, setFps]);

  return { cycleFps };
}
