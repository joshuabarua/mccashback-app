import { NativeModules } from 'react-native';

export type ExposureCapabilities = {
  minExposureNs: number;
  maxExposureNs: number;
  minIso: number;
  maxIso: number;
  supportsManual: boolean;
};

export type CurrentExposure = {
  exposureNs: number;
  iso: number;
};

// Expected native module shape
interface ExposureModule {
  getExposureCapabilities: () => Promise<ExposureCapabilities>;
  setManualExposure: (exposureNs: number, iso?: number) => Promise<void>;
  enableAutoExposure: () => Promise<void>;
  setTargetFps: (fps: number, preferLowResolution?: boolean) => Promise<{ appliedFps: number; width: number; height: number }>;
  resetFrameRate: () => Promise<void>;
  // JS-only convenience; not implemented natively
  isLowFpsAvailable?: () => boolean;
  // New native method
  getCurrentExposure: () => Promise<CurrentExposure>;
}

const LINKING_ERROR =
  `The native module 'Exposure' is not linked.\n` +
  `Make sure you have implemented the native code for iOS and Android, ` +
  `then rebuilt your Dev Client (expo prebuild && expo run:<platform>).`;

const Native: ExposureModule | undefined = (NativeModules as any)?.Exposure;

const Exposure: ExposureModule = {
  async getExposureCapabilities() {
    if (!Native) throw new Error(LINKING_ERROR);
    return Native.getExposureCapabilities();
  },
  async setManualExposure(exposureNs: number, iso?: number) {
    if (!Native) throw new Error(LINKING_ERROR);
    return Native.setManualExposure(exposureNs, iso);
  },
  async enableAutoExposure() {
    if (!Native) throw new Error(LINKING_ERROR);
    return Native.enableAutoExposure();
  },
  async setTargetFps(fps: number, preferLowResolution: boolean = true) {
    if (!Native || !(Native as any).setTargetFps) {
      console.warn('[Exposure] setTargetFps not available yet (native not linked). Returning fallback.');
      return { appliedFps: fps, width: 0, height: 0 };
    }
    return (Native as any).setTargetFps(fps, preferLowResolution);
  },
  async resetFrameRate() {
    // If the native method isn't linked yet, just resolve without throwing
    if (!Native || !(Native as any).resetFrameRate) return;
    return (Native as any).resetFrameRate();
  },
  isLowFpsAvailable() {
    const m = Native as any;
    return !!m && typeof m.setTargetFps === 'function' && typeof m.resetFrameRate === 'function';
  },
  async getCurrentExposure() {
    if (!Native || !(Native as any).getCurrentExposure) {
      return { exposureNs: 0, iso: 0 };
    }
    return (Native as any).getCurrentExposure();
  },
};

export default Exposure;
