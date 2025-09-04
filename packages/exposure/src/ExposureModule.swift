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
}
