package com.joshuabarua.mccashback

import androidx.camera.camera2.interop.Camera2CameraControl

object ExposureBridge {
  @JvmStatic
  @Volatile
  var camera2Control: Camera2CameraControl? = null
}
