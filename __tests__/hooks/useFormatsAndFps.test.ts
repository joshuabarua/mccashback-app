import type { CameraDevice, CameraDeviceFormat } from 'react-native-vision-camera';
import {
  clampFps,
  findNearestOption,
  formatArea,
  getDeviceFpsRange,
  getSupportedFpsOptions,
  SAFE_IOS_FPS_OPTIONS,
  selectBestFormat,
  supportsTargetFps,
} from '../../hooks/useFormatsAndFps';

const TARGET_AREA_1080P = 1920 * 1080;

function makeFormat(
  overrides: Partial<CameraDeviceFormat> & { videoWidth: number; videoHeight: number; minFps: number; maxFps: number },
): CameraDeviceFormat {
  return {
    autoFocusSystem: 'contrast-detection',
    fieldOfView: 60,
    maxISO: 1600,
    minISO: 50,
    pixelFormat: '420f',
    supportsDepthCapture: false,
    supportsPhotoHDR: false,
    supportsVideoHDR: false,
    videoStabilizationModes: ['auto'],
    ...overrides,
  } as CameraDeviceFormat;
}

function makeDevice(formats: CameraDeviceFormat[]): CameraDevice {
  return {
    id: 'test-device',
    position: 'back',
    hasFlash: true,
    hasTorch: true,
    isMultiCam: false,
    name: 'Test Camera',
    neutralZoom: 1,
    minZoom: 1,
    maxZoom: 10,
    hardwareLevel: 'full',
    formats,
  } as unknown as CameraDevice;
}

describe('formatArea', () => {
  it('computes width * height', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 30, maxFps: 30 });
    expect(formatArea(f)).toBe(1920 * 1080);
  });
});

describe('supportsTargetFps', () => {
  it('returns true when target fps is inside range', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 1, maxFps: 60 });
    expect(supportsTargetFps(f, 30, 'android')).toBe(true);
  });

  it('returns false when target fps is outside range', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 10, maxFps: 30 });
    expect(supportsTargetFps(f, 60, 'android')).toBe(false);
  });

  it('tolerates iOS 24 fps cinema rate', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 23.5, maxFps: 24.5 });
    expect(supportsTargetFps(f, 24, 'ios')).toBe(true);
  });

  it('tolerates iOS 30 fps NTSC rate', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 29.5, maxFps: 30.5 });
    expect(supportsTargetFps(f, 30, 'ios')).toBe(true);
  });

  it('tolerates iOS 60 fps NTSC rate', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 59.0, maxFps: 60.5 });
    expect(supportsTargetFps(f, 60, 'ios')).toBe(true);
  });
});

describe('selectBestFormat', () => {
  it('returns undefined when device has no formats', () => {
    const device = makeDevice([]);
    expect(selectBestFormat(device, 30, false)).toBeUndefined();
  });

  it('prefers 1080p-or-below format for non-quality-first mode', () => {
    const sd = makeFormat({ videoWidth: 640, videoHeight: 480, minFps: 30, maxFps: 30 });
    const hd = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 30, maxFps: 30 });
    const uhd = makeFormat({ videoWidth: 3840, videoHeight: 2160, minFps: 30, maxFps: 30 });
    const device = makeDevice([uhd, hd, sd]);
    expect(selectBestFormat(device, 30, false)).toBe(hd);
  });

  it('prefers highest resolution when qualityFirst is true', () => {
    const hd = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 30, maxFps: 30 });
    const uhd = makeFormat({ videoWidth: 3840, videoHeight: 2160, minFps: 30, maxFps: 30 });
    const device = makeDevice([hd, uhd]);
    expect(selectBestFormat(device, 30, true)).toBe(uhd);
  });

  it('prefers non-HFR formats when fps <= 60', () => {
    const hfr = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 120, maxFps: 240 });
    const normal = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 30, maxFps: 60 });
    const device = makeDevice([hfr, normal]);
    expect(selectBestFormat(device, 30, false)).toBe(normal);
  });

  it('falls back to closest format when no candidate supports target fps', () => {
    const low = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 10, maxFps: 30 });
    const device = makeDevice([low]);
    expect(selectBestFormat(device, 60, false)).toBe(low);
  });
});

describe('getDeviceFpsRange', () => {
  it('returns default range when device is undefined', () => {
    expect(getDeviceFpsRange(undefined)).toEqual({ min: 15, max: 60 });
  });

  it('computes min and max across all formats', () => {
    const f1 = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 1, maxFps: 30 });
    const f2 = makeFormat({ videoWidth: 1280, videoHeight: 720, minFps: 30, maxFps: 240 });
    const device = makeDevice([f1, f2]);
    expect(getDeviceFpsRange(device)).toEqual({ min: 1, max: 240 });
  });
});

describe('getSupportedFpsOptions', () => {
  it('returns safe iOS options within range when not extended', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 1, maxFps: 60 });
    const options = getSupportedFpsOptions(f, 30, false, 'ios');
    expect(options).toEqual(SAFE_IOS_FPS_OPTIONS.filter((v) => v >= 1 && v <= 60));
  });

  it('returns dense integer options on iOS when extended', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 1, maxFps: 5 });
    const options = getSupportedFpsOptions(f, 3, true, 'ios');
    expect(options).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns dense integer options on Android', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 10, maxFps: 15 });
    const options = getSupportedFpsOptions(f, 12, false, 'android');
    expect(options).toEqual([10, 11, 12, 13, 14, 15]);
  });

  it('falls back when range is empty', () => {
    const f = makeFormat({ videoWidth: 1920, videoHeight: 1080, minFps: 60, maxFps: 60 });
    const options = getSupportedFpsOptions(f, 60, false, 'android');
    expect(options).toEqual([60]);
  });
});

describe('clampFps', () => {
  it('clamps fps to range', () => {
    expect(clampFps(10, 60, 5)).toBe(10);
    expect(clampFps(10, 60, 70)).toBe(60);
    expect(clampFps(10, 60, 30)).toBe(30);
  });
});

describe('findNearestOption', () => {
  it('finds nearest option', () => {
    expect(findNearestOption([10, 20, 30], 22)).toBe(20);
    expect(findNearestOption([10, 20, 30], 29)).toBe(30);
    expect(findNearestOption([10], 100)).toBe(10);
  });
});
