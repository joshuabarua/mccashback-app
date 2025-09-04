import { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import Exposure, { type ExposureCapabilities } from '../native/Exposure';

export type PendingZoetrope = { type: 'set' | 'auto'; ns?: number };

export type UseExposureControlParams = {
  cameraInitialized: boolean;
  effectiveFps: number | null | undefined;
  fps: number;
  zoetropeEnabled: boolean;
  isConfiguring: boolean;
  cameraReadyRef: MutableRefObject<boolean>;
  pendingZoetropeRef?: MutableRefObject<null | PendingZoetrope>;
  showToast: (msg: string) => void;
};

export function useExposureControl({
  cameraInitialized,
  effectiveFps,
  fps,
  zoetropeEnabled,
  isConfiguring,
  cameraReadyRef,
  pendingZoetropeRef,
  showToast,
}: UseExposureControlParams) {
  const [exposureMode, setExposureMode] = useState<'auto' | 'manual'>('auto');
  const [currentShutterNs, setCurrentShutterNs] = useState<number | null>(null);
  const [supportsManual, setSupportsManual] = useState<boolean>(false);
  const [caps, setCaps] = useState<ExposureCapabilities | null>(null);

  // Query exposure capabilities only after camera is initialized
  useEffect(() => {
    if (!cameraInitialized) return;
    let mounted = true;
    Exposure.getExposureCapabilities()
      .then((c) => {
        if (!mounted) return;
        setSupportsManual(!!c.supportsManual);
        setCaps(c);
      })
      .catch(() => {
        if (!mounted) return;
        setSupportsManual(false);
        setCaps(null);
      });
    return () => {
      mounted = false;
    };
  }, [cameraInitialized]);

  // While Zoetrope is enabled, keep shutter at the shortest supported exposure
  useEffect(() => {
    if (!zoetropeEnabled || !supportsManual) return;
    const targetFps = effectiveFps || fps || 30;
    const fallback = Math.round(1e9 / (4 * targetFps));
    const desired = caps?.minExposureNs ?? fallback;
    const minNs = caps?.minExposureNs ?? desired;
    const maxNs = caps?.maxExposureNs ?? desired;
    const clamped = Math.max(minNs, Math.min(maxNs, desired));
    const tol = 1e6; // 1ms tolerance
    const needsUpdate = currentShutterNs == null || Math.abs(currentShutterNs - clamped) > tol || exposureMode !== 'manual';
    if (!needsUpdate) return;
    if (cameraReadyRef.current && !isConfiguring) {
      (async () => {
        try {
          await Exposure.setManualExposure(clamped, caps?.maxIso);
          setExposureMode('manual');
          setCurrentShutterNs(clamped);
        } catch (e) {
          console.error('Exposure.setManualExposure failed while maintaining shutter', e);
        }
      })();
    } else if (pendingZoetropeRef) {
      pendingZoetropeRef.current = { type: 'set', ns: clamped };
    }
  }, [zoetropeEnabled, supportsManual, caps, effectiveFps, fps, isConfiguring, currentShutterNs, exposureMode, cameraReadyRef, pendingZoetropeRef]);

  const handleSliderChangeNs = useCallback((ns: number) => {
    setCurrentShutterNs(ns);
  }, []);

  const handleSliderCompleteNs = useCallback(async (ns: number) => {
    try {
      await Exposure.setManualExposure(ns);
      setCurrentShutterNs(ns);
      setExposureMode('manual');
    } catch {
      showToast('Shutter not supported');
    }
  }, [showToast]);

  const setPreset180 = useCallback(async () => {
    const fpsForShutter = effectiveFps || fps || 30;
    const ns = Math.round(1e9 / (2 * fpsForShutter));
    try {
      await Exposure.setManualExposure(ns);
      setCurrentShutterNs(ns);
      setExposureMode('manual');
    } catch {
      showToast('Shutter not supported');
    }
  }, [effectiveFps, fps, showToast]);

  return {
    exposureMode,
    setExposureMode,
    currentShutterNs,
    setCurrentShutterNs,
    supportsManual,
    caps,
    handleSliderChangeNs,
    handleSliderCompleteNs,
    setPreset180,
  } as const;
}
