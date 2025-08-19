import { NativeModules } from 'react-native';

export type ExposureCapabilities = {
  minExposureNs: number;
  maxExposureNs: number;
  minIso: number;
  maxIso: number;
  supportsManual: boolean;
};

// Expected native module shape
interface ExposureModule {
  getExposureCapabilities: () => Promise<ExposureCapabilities>;
  setManualExposure: (exposureNs: number, iso?: number) => Promise<void>;
  enableAutoExposure: () => Promise<void>;
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
};

export default Exposure;
