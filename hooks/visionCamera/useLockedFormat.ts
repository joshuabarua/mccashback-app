import { useEffect, useState } from 'react';
import type { CameraDeviceFormat } from 'react-native-vision-camera';

export function useLockedFormat(
  initialized: boolean,
  selectedFormat: CameraDeviceFormat | undefined,
) {
  const [lockedFormat, setLockedFormat] = useState<CameraDeviceFormat | undefined>(undefined);
  useEffect(() => {
    if (!initialized) return;
    if (!lockedFormat && selectedFormat) {
      setLockedFormat(selectedFormat);
    }
  }, [initialized, lockedFormat, selectedFormat]);
  return { lockedFormat, setLockedFormat };
}
