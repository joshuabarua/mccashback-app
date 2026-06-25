import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { Camera, CameraDevice } from 'react-native-vision-camera';
import { useFormatsAndFps } from './useFormatsAndFps';
import { useCameraMount } from './visionCamera/useCameraMount';
import { useElapse } from './visionCamera/useElapse';
import { useFlashToast } from './visionCamera/useFlashToast';
import { useHzLogging } from './visionCamera/useHzLogging';
import { useHzScheduler } from './visionCamera/useHzScheduler';
import { useLockedFormat } from './visionCamera/useLockedFormat';
import { useManualExposure } from './visionCamera/useManualExposure';
import { useRpm } from './visionCamera/useRpm';
import { useSliderOptions } from './visionCamera/useSliderOptions';
import { useSpinAnimation } from './visionCamera/useSpinAnimation';

// Composition root: wires together focused sub-hooks; flagged only for hook count.
// fallow-ignore-next-line complexity
export function useVisionCameraScreen(device: CameraDevice | undefined) {
  const router = useRouter();
  const cameraRef = useRef<Camera | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [requestedHz, setRequestedHz] = useState(14);
  const [appliedHz, setAppliedHz] = useState(14);
  const [torch, setTorch] = useState<'on' | 'off'>('off');
  const [driftMode, setDriftMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const elapse = useElapse();
  const spin = useSpinAnimation(initialized);

  const { selectedFormat, effectiveFps } = useFormatsAndFps(device, requestedHz, setAppliedHz, false, true);
  const { lockedFormat, setLockedFormat } = useLockedFormat(initialized, selectedFormat);

  const { cameraKeyForMount, handleRetryInit, selectedFormatProp, cameraFpsDuringInit } =
    useCameraMount(initialized, lockedFormat, selectedFormat, appliedHz);

  const { showFlashToast, flashToastOpacity } = useFlashToast(initialized);

  const { expMinNs, expMaxNs, expNs, setExpNs, expMinClamp, expMaxClamp, applyExposure } =
    useManualExposure(initialized, appliedHz, elapse);

  const { sliderOptions, sliderIndex } = useSliderOptions(lockedFormat, selectedFormat, requestedHz);

  const rpm = useRpm(effectiveFps, appliedHz);

  useHzLogging(requestedHz, appliedHz, effectiveFps, elapse);
  useHzScheduler(initialized, driftMode, requestedHz, appliedHz, sliderOptions, setAppliedHz);

  const handleBack = useCallback(() => {
    setIsActive(false);
    router.back();
  }, [router]);

  return {
    cameraRef,
    isActive,
    setRequestedHz,
    appliedHz,
    setAppliedHz,
    torch,
    setTorch,
    driftMode,
    setDriftMode,
    initialized,
    setInitialized,
    spin,
    selectedFormat,
    effectiveFps,
    lockedFormat,
    setLockedFormat,
    cameraKeyForMount,
    handleRetryInit,
    cameraFpsDuringInit,
    selectedFormatProp,
    flashToastOpacity,
    showFlashToast,
    handleBack,
    expMinNs,
    expMaxNs,
    expNs,
    setExpNs,
    expMinClamp,
    expMaxClamp,
    applyExposure,
    sliderOptions,
    sliderIndex,
    rpm,
    elapse,
  };
}
