import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Exposure from '../../native/Exposure';

const FAST_SHUTTER_NS = 700_000;
const MIN_EXPOSURE_CLAMP_NS = 100_000;
const MAX_EXPOSURE_CLAMP_NS = 900_000;

export function useManualExposure(
  initialized: boolean,
  appliedHz: number,
  elapse: () => string,
) {
  const [expMinNs, setExpMinNs] = useState<number | null>(null);
  const [expMaxNs, setExpMaxNs] = useState<number | null>(null);
  const [expNs, setExpNs] = useState<number | null>(null);

  // Apply a fast manual shutter once on init
  const isoSetRef = useRef(false);
  useEffect(() => {
    if (!initialized || isoSetRef.current) return;
    // fallow-ignore-next-line complexity
    (async () => {
      try {
        const caps = await Exposure.getExposureCapabilities();
        if (!caps?.supportsManual) return;
        await Exposure.setManualExposure(FAST_SHUTTER_NS);
        console.log(
          `[Exposure] Applied manual shutter: ${(FAST_SHUTTER_NS / 1e9).toFixed(6)}s (${FAST_SHUTTER_NS} ns), ISO kept`,
        );
        setExpNs(FAST_SHUTTER_NS);
        try {
          const current = await Exposure.getCurrentExposure();
          console.log(
            `[Exposure] Device reports shutter: ${(current.exposureNs / 1e9).toFixed(6)}s (${Math.round(
              current.exposureNs,
            )} ns), ISO: ${Math.round(current.iso)}`,
          );
        } catch {}
        isoSetRef.current = true;
      } catch (e) {
        console.warn('Setting fast manual exposure failed or unsupported', e);
      }
    })();
  }, [initialized]);

  // Fetch supported exposure range
  useEffect(() => {
    if (!initialized) return;
    let active = true;
    // fallow-ignore-next-line complexity
    (async () => {
      try {
        const caps = await Exposure.getExposureCapabilities();
        if (!active) return;
        if (caps?.supportsManual) {
          setExpMinNs(caps.minExposureNs);
          setExpMaxNs(caps.maxExposureNs);
          try {
            const cur = await Exposure.getCurrentExposure();
            if (!active) return;
            setExpNs(cur.exposureNs);
          } catch {
            setExpNs(null);
          }
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [initialized]);

  const expMinClamp = useMemo(() => Math.max(expMinNs ?? 0, MIN_EXPOSURE_CLAMP_NS), [expMinNs]);
  const expMaxClamp = useMemo(
    () => Math.min(expMaxNs ?? Number.MAX_SAFE_INTEGER, MAX_EXPOSURE_CLAMP_NS),
    [expMaxNs],
  );

  const applyExposure = useCallback(
    async (ns: number) => {
      try {
        await Exposure.setManualExposure(ns);
        setExpNs(ns);
        console.log(`[Exposure ${elapse()}] setManualExposure -> ${(ns / 1e9).toFixed(6)}s (${Math.round(ns)} ns)`);
        try {
          const cur = await Exposure.getCurrentExposure();
          console.log(
            `[Exposure ${elapse()}] device now ${(cur.exposureNs / 1e9).toFixed(6)}s (${Math.round(
              cur.exposureNs,
            )} ns), ISO ${Math.round(cur.iso)}`,
          );
        } catch {}
      } catch (e) {
        console.warn('setManualExposure failed', e);
      }
    },
    [elapse],
  );

  // Re-apply exposure shortly after fps changes
  useEffect(() => {
    if (!initialized) return;
    if (expNs == null) return;
    const ns = expNs;
    const id = setTimeout(() => {
      applyExposure(ns);
    }, 150);
    return () => clearTimeout(id);
  }, [initialized, appliedHz, applyExposure, expNs]);

  return { expMinNs, expMaxNs, expNs, setExpNs, expMinClamp, expMaxClamp, applyExposure };
}
