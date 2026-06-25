import { useCallback, useEffect, useRef } from 'react';

export function useElapse() {
  const t0Ref = useRef<number>(Date.now());
  const elapse = useCallback(() => `${((Date.now() - t0Ref.current) / 1000).toFixed(3)}s`, []);
  useEffect(() => {
    console.log(`[Init ${elapse()}] VisionCameraScreen mounted`);
  }, [elapse]);
  return elapse;
}
