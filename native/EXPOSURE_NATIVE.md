# Exposure Native Module Scaffold

This app includes a JS interface at `native/Exposure.ts` and a UI hook-up in `app/vision-camera.native.tsx`.

To enable manual shutter/exposure, implement a native module named `Exposure` for iOS and Android, then rebuild the Dev Client.

## 1) Rebuild workflow
- expo prebuild
- expo run:ios or expo run:android

## 2) iOS (Swift, AVFoundation)
1. In `ios/` Xcode project, create a Swift file `Exposure.swift` under the app target.
2. Add the following minimal implementation:

```swift
import Foundation
import AVFoundation
import React

@objc(Exposure)
class Exposure: NSObject {
  private func withDevice(_ block: (AVCaptureDevice) throws -> Void) throws {
    let discovery = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera], mediaType: .video, position: .back)
    guard let device = discovery.devices.first else { throw NSError(domain: "Exposure", code: -1) }
    try device.lockForConfiguration()
    defer { device.unlockForConfiguration() }
    try block(device)
  }

  @objc
  func getExposureCapabilities(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try withDevice { device in
        resolve([
          "minExposureNs": device.activeFormat.minExposureDuration.seconds * 1e9,
          "maxExposureNs": device.activeFormat.maxExposureDuration.seconds * 1e9,
          "minIso": device.activeFormat.minISO,
          "maxIso": device.activeFormat.maxISO,
          "supportsManual": true,
        ])
      }
    } catch {
      reject("E_EXPO", "Failed caps", error)
    }
  }

  @objc
  func setManualExposure(_ exposureNs: NSNumber, iso: NSNumber?, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try withDevice { device in
        let seconds = CMTimeMakeWithSeconds(exposureNs.doubleValue / 1e9, preferredTimescale: 1_000_000_000)
        let targetISO = iso?.floatValue ?? device.activeFormat.minISO
        device.setExposureModeCustom(duration: seconds, iso: targetISO, completionHandler: nil)
        resolve(nil)
      }
    } catch {
      reject("E_EXPO", "Failed set", error)
    }
  }

  @objc
  func enableAutoExposure(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do {
      try withDevice { device in
        device.exposureMode = .continuousAutoExposure
        resolve(nil)
      }
    } catch {
      reject("E_EXPO", "Failed auto", error)
    }
  }
}
```

3. Create a bridging file `Exposure.m`:
```objc
#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(Exposure, NSObject)
RCT_EXTERN_METHOD(getExposureCapabilities:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setManualExposure:(nonnull NSNumber *)exposureNs iso:(nullable NSNumber *)iso resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(enableAutoExposure:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
```

## 3) Android (Kotlin, Camera2)
1. Under `android/app/src/main/java/<package>/`, add `ExposureModule.kt` and `ExposurePackage.kt`.

```kotlin
package com.anonymous.mccashback

import com.facebook.react.bridge.*
import android.hardware.camera2.*

class ExposureModule(reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "Exposure"

  @ReactMethod
  fun getExposureCapabilities(promise: Promise) {
    // TODO: Query via CameraManager/CameraCharacteristics
    val map = Arguments.createMap()
    map.putDouble("minExposureNs", 1e6)
    map.putDouble("maxExposureNs", 3.3e7)
    map.putDouble("minIso", 50.0)
    map.putDouble("maxIso", 1600.0)
    map.putBoolean("supportsManual", true)
    promise.resolve(map)
  }

  @ReactMethod
  fun setManualExposure(exposureNs: Double, iso: Double?, promise: Promise) {
    // TODO: Build a repeating request with CONTROL_AE_MODE OFF, SENSOR_EXPOSURE_TIME, SENSOR_SENSITIVITY
    promise.resolve(null)
  }

  @ReactMethod
  fun enableAutoExposure(promise: Promise) {
    // TODO: Set CONTROL_AE_MODE = ON, restore repeating request
    promise.resolve(null)
  }
}
```

```kotlin
package com.anonymous.mccashback

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.bridge.NativeModule
import com.facebook.react.ReactPackage

class ExposurePackage: ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(ExposureModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
```

2. Register the package in `MainApplication.kt` under `getPackages()`.

## Notes
- This is a scaffold; production code must manage the same camera session that VisionCamera uses.
- On Android you must integrate with the session controlled by VisionCamera or expose a hook inside your camera implementation.
- Start with iOS for quickest results; Android requires more plumbing with Camera2.
