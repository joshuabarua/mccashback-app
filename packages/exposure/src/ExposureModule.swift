import Foundation
import AVFoundation
import React

@objc(Exposure)
class Exposure: NSObject {
  private var device: AVCaptureDevice? {
    if let d = _device { return d }
    _device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
    return _device
  }
  private var _device: AVCaptureDevice?

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  @objc(getExposureCapabilities:rejecter:)
  func getExposureCapabilities(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let d = self.device, let fmt = d.activeFormat as AVCaptureDevice.Format? else {
        resolve([
          "minExposureNs": 0,
          "maxExposureNs": 0,
          "minIso": 0,
          "maxIso": 0,
          "supportsManual": false
        ])
        return
      }
      let minDur = fmt.minExposureDuration
      let maxDur = fmt.maxExposureDuration
      let minNs = CMTimeGetSeconds(minDur) * 1_000_000_000
      let maxNs = CMTimeGetSeconds(maxDur) * 1_000_000_000
      let minISO = fmt.minISO
      let maxISO = fmt.maxISO
      let supports = d.isExposureModeSupported(.custom)
      resolve([
        "minExposureNs": NSNumber(value: minNs),
        "maxExposureNs": NSNumber(value: maxNs),
        "minIso": NSNumber(value: minISO),
        "maxIso": NSNumber(value: maxISO),
        "supportsManual": supports
      ])
    }
  }

  @objc(setManualExposure:iso:resolver:rejecter:)
  func setManualExposure(_ exposureNs: NSNumber,
                         iso: NSNumber?,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let d = self.device else { resolve(nil); return }
      do {
        guard d.isExposureModeSupported(.custom) else {
          reject("exposure_not_supported", "Manual exposure not supported on this device", nil)
          return
        }
        try d.lockForConfiguration()
        // Clamp duration to supported range for active format
        let fmt = d.activeFormat
        let minSeconds = CMTimeGetSeconds(fmt.minExposureDuration)
        let maxSeconds = CMTimeGetSeconds(fmt.maxExposureDuration)
        let requested = Double(truncating: exposureNs) / 1_000_000_000.0
        let clampedSeconds = max(minSeconds, min(maxSeconds, requested))
        let duration = CMTimeMakeWithSeconds(clampedSeconds, preferredTimescale: 1_000_000_000)

        // Clamp ISO if provided, otherwise pick a high but valid ISO to compensate for short exposure
        let minISO = fmt.minISO
        let maxISO = fmt.maxISO
        var isoValue: Float
        if let isoNum = iso?.floatValue {
          isoValue = max(minISO, min(maxISO, isoNum))
        } else {
          isoValue = max(minISO, min(maxISO, maxISO))
        }

        d.setExposureModeCustom(duration: duration, iso: isoValue, completionHandler: nil)
        d.unlockForConfiguration()
        resolve(nil)
      } catch let error as NSError {
        reject("exposure_lock_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(enableAutoExposure:rejecter:)
  func enableAutoExposure(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let d = self.device else { resolve(nil); return }
      do {
        try d.lockForConfiguration()
        if d.isExposureModeSupported(.continuousAutoExposure) {
          d.exposureMode = .continuousAutoExposure
        } else if d.isExposureModeSupported(.autoExpose) {
          d.exposureMode = .autoExpose
        }
        d.unlockForConfiguration()
        resolve(nil)
      } catch let error as NSError {
        reject("exposure_auto_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(setTargetFps:preferLowResolution:resolver:rejecter:)
  func setTargetFps(_ targetFps: NSNumber,
                    preferLowResolution: NSNumber?,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let d = self.device else { reject("device_unavailable", "Camera device unavailable", nil); return }
      let fps = Double(truncating: targetFps)
      let preferLow = (preferLowResolution?.boolValue ?? true)
      do {
        try d.lockForConfiguration()

        // Find formats that support the target fps
        let candidates: [AVCaptureDevice.Format] = d.formats.filter { format in
          for range in format.videoSupportedFrameRateRanges {
            if fps >= Double(range.minFrameRate) - 0.001 && fps <= Double(range.maxFrameRate) + 0.001 {
              return true
            }
          }
          return false
        }

        func area(_ f: AVCaptureDevice.Format) -> Int {
          let dims = CMVideoFormatDescriptionGetDimensions(f.formatDescription)
          return Int(dims.width) * Int(dims.height)
        }

        let chosen: AVCaptureDevice.Format? = {
          if candidates.isEmpty { return nil }
          if preferLow {
            return candidates.sorted { area($0) < area($1) }.first
          } else {
            return candidates.sorted { area($0) > area($1) }.first
          }
        }()

        if let fmt = chosen {
          d.activeFormat = fmt
        }

        // Apply exact frame durations for requested fps
        if fps > 0 {
          let duration = CMTimeMakeWithSeconds(1.0 / fps, preferredTimescale: 1_000_000_000)
          d.activeVideoMinFrameDuration = duration
          d.activeVideoMaxFrameDuration = duration
        }

        // Read back the applied fps and format info
        let dims = CMVideoFormatDescriptionGetDimensions(d.activeFormat.formatDescription)
        let appliedMin = CMTimeGetSeconds(d.activeVideoMinFrameDuration)
        let appliedFps = appliedMin > 0 ? (1.0 / appliedMin) : 0

        d.unlockForConfiguration()

        resolve([
          "appliedFps": NSNumber(value: appliedFps),
          "width": NSNumber(value: Int(dims.width)),
          "height": NSNumber(value: Int(dims.height))
        ])
      } catch let error as NSError {
        reject("lowfps_config_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(resetFrameRate:rejecter:)
  func resetFrameRate(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let d = self.device else { resolve(nil); return }
      do {
        try d.lockForConfiguration()
        d.activeVideoMinFrameDuration = CMTime.invalid
        d.activeVideoMaxFrameDuration = CMTime.invalid
        d.unlockForConfiguration()
        resolve(nil)
      } catch let error as NSError {
        reject("lowfps_reset_failed", error.localizedDescription, error)
      }
    }
  }
}
