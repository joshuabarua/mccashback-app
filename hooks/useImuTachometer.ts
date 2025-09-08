import { useEffect, useMemo, useRef, useState } from 'react';

export type UseImuTachometerParams = {
  enabled: boolean;
  windowSize?: number; // samples for smoothing
  updateIntervalMs?: number; // sensor sampling interval
};

export function useImuTachometer({ enabled, windowSize = 12, updateIntervalMs = 16 }: UseImuTachometerParams) {
  const [rpm, setRpm] = useState<number>(0);
  const [available, setAvailable] = useState<boolean>(false);
  const bufferRef = useRef<number[]>([]);
  const subRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const Sensors = await import('expo-sensors');
        const { Gyroscope } = Sensors as any;
        if (!Gyroscope) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        if (typeof Gyroscope.setUpdateInterval === 'function') {
          Gyroscope.setUpdateInterval(updateIntervalMs);
        }
        subRef.current = Gyroscope.addListener((data: { x: number; y: number; z: number }) => {
          // z is rotation around device's z-axis (screen normal). Use absolute value.
          const omegaZ = Math.abs(data?.z ?? 0); // rad/s
          const rpmInstant = omegaZ * (60 / (2 * Math.PI)); // rad/s -> rev/s -> RPM
          const buf = bufferRef.current;
          buf.push(rpmInstant);
          if (buf.length > windowSize) buf.shift();
          const mean = buf.reduce((a, b) => a + b, 0) / Math.max(1, buf.length);
          if (!cancelled) setRpm(mean);
        });
      } catch {
        // expo-sensors not available or failed to initialize
        setAvailable(false);
      }
    }

    if (enabled) {
      bufferRef.current = [];
      start();
    }
    return () => {
      cancelled = true;
      if (subRef.current && typeof subRef.current.remove === 'function') {
        subRef.current.remove();
      }
      subRef.current = null;
    };
  }, [enabled, windowSize, updateIntervalMs]);

  const rounded = useMemo(() => (Number.isFinite(rpm) ? Math.round(rpm) : 0), [rpm]);

  return { rpm, rounded, available } as const;
}
