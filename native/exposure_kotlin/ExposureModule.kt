package com.joshuabarua.mccashback

import android.hardware.camera2.CaptureRequest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import androidx.camera.camera2.interop.CaptureRequestOptions

@ReactModule(name = ExposureModule.NAME)
class ExposureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    const val NAME = "Exposure"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun getExposureCapabilities(promise: Promise) {
    try {
      val map = Arguments.createMap()
      map.putDouble("minExposureNs", 250_000.0) // ~1/4000s (example)
      map.putDouble("maxExposureNs", 100_000_000.0) // 1/10s (example)
      map.putDouble("minIso", 50.0)
      map.putDouble("maxIso", 6400.0)
      map.putBoolean("supportsManual", ExposureBridge.camera2Control != null)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_CAPS", "Failed to get exposure capabilities", e)
    }
  }

  @ReactMethod
  fun setManualExposure(exposureNs: Double, iso: Double?, promise: Promise) {
    val control = ExposureBridge.camera2Control
    if (control == null) {
      promise.reject("E_NO_SESSION", "Camera session not available. Ensure VisionCamera passes Camera2 control to ExposureBridge.")
      return
    }
    try {
      val builder = CaptureRequestOptions.Builder()
        .set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
        .set(CaptureRequest.SENSOR_EXPOSURE_TIME, exposureNs.toLong())
      if (iso != null) builder.set(CaptureRequest.SENSOR_SENSITIVITY, iso.toInt())
      control.setCaptureRequestOptions(builder.build())
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SET_MANUAL", "Failed setting manual exposure", e)
    }
  }

  @ReactMethod
  fun enableAutoExposure(promise: Promise) {
    val control = ExposureBridge.camera2Control
    if (control == null) {
      promise.reject("E_NO_SESSION", "Camera session not available. Ensure VisionCamera passes Camera2 control to ExposureBridge.")
      return
    }
    try {
      val builder = CaptureRequestOptions.Builder()
        .set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
      control.setCaptureRequestOptions(builder.build())
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SET_AUTO", "Failed enabling auto exposure", e)
    }
  }
}
