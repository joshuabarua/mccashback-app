import { useEffect } from 'react';

export function useHzLogging(
  requestedHz: number,
  appliedHz: number,
  effectiveFps: number,
  elapse: () => string,
) {
  useEffect(() => {
    console.log(`[Hz ${elapse()}] requestedHz=${requestedHz.toFixed(3)} (${(requestedHz * 60).toFixed(0)} rpm)`);
  }, [requestedHz, elapse]);
  useEffect(() => {
    console.log(`[Hz ${elapse()}] appliedHz=${appliedHz.toFixed(3)} (${(appliedHz * 60).toFixed(0)} rpm)`);
  }, [appliedHz, elapse]);
  useEffect(() => {
    if (!Number.isFinite(effectiveFps)) return;
    console.log(
      `[Hz ${elapse()}] effectiveFps=${Number(effectiveFps).toFixed(3)} (${(Number(effectiveFps) * 60).toFixed(0)} rpm)`,
    );
  }, [effectiveFps, elapse]);
}
