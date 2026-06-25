import { useCallback, useMemo, useRef, useState } from 'react';
import type { CameraDeviceFormat } from 'react-native-vision-camera';

export function useCameraMount(
  initialized: boolean,
  lockedFormat: CameraDeviceFormat | undefined,
  selectedFormat: CameraDeviceFormat | undefined,
  appliedHz: number,
) {
  const stableKeyRef = useRef('camera-stable');
  const [bootNonce, setBootNonce] = useState(0);

  const handleRetryInit = useCallback(() => {
    setBootNonce((n) => n + 1);
  }, []);

  const cameraKeyForMount = useMemo(
    () => (initialized ? stableKeyRef.current : `boot-${bootNonce}`),
    [initialized, bootNonce],
  );

  const selectedFormatProp = initialized ? (lockedFormat ?? selectedFormat) : undefined;
  const cameraFpsDuringInit = initialized ? appliedHz : undefined;

  return { cameraKeyForMount, handleRetryInit, selectedFormatProp, cameraFpsDuringInit };
}
