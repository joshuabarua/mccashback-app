package com.anonymous.mccashback

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = ExposureModule.NAME)
class ExposureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    const val NAME = "Exposure"
  }

  override fun getName(): String = NAME

  // Returns capabilities. For now, stub with supportsManual = false so UI disables controls.
  @ReactMethod
  fun getExposureCapabilities(promise: Promise) {
    try {
      val map = Arguments.createMap()
      map.putDouble("minExposureNs", 1_000_000.0) // 1/1000s stub
      map.putDouble("maxExposureNs", 33_000_000.0) // ~1/30s stub
      map.putDouble("minIso", 50.0)
      map.putDouble("maxIso", 1600.0)
      map.putBoolean("supportsManual", false)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_CAPS", "Failed to get exposure capabilities", e)
    }
  }

  // No-op for stub. Once integrated with VisionCamera's session, set AE OFF and SENSOR_EXPOSURE_TIME.
  @ReactMethod
  fun setManualExposure(exposureNs: Double, iso: Double?, promise: Promise) {
    // Stub: resolve without doing anything. You may choose to reject to surface unsupported state.
    promise.resolve(null)
  }

  // No-op for stub. Once integrated, set AE ON.
  @ReactMethod
  fun enableAutoExposure(promise: Promise) {
    promise.resolve(null)
  }
}
