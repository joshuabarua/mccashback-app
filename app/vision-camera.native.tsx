import BackButton from "@/components/BackButton";
import Slider from "@react-native-community/slider";
import React, { useEffect } from "react";
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    useCameraDevice,
    useCameraPermission,
} from "react-native-vision-camera";
import VisionCameraView from "../components/VisionCameraView";
import { useVisionCameraScreen } from "../hooks/useVisionCameraScreen";
const wheelsSpinAsset = require("../assets/images/wheelsboxes.png");

const CameraSpinner = ({ spin }: { spin: Animated.AnimatedInterpolation<string> }) => (
  <View style={styles.spinnerWrapper}>
    <Animated.Image
      source={wheelsSpinAsset}
      style={{ width: 160, height: 160, opacity: 0.2, transform: [{ rotate: spin }] }}
      resizeMode="contain"
    />
  </View>
);

// fallow-ignore-next-line complexity
export default function VisionCameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const insets = useSafeAreaInsets();
  const camera = useVisionCameraScreen(device);

  // Ensure camera permission
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);


  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <CameraSpinner spin={camera.spin} />
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Do not early-return on initializing anymore; show overlay instead so Camera can mount

  if (!device) {
    return (
      <View style={styles.container}>
        <CameraSpinner spin={camera.spin} />
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VisionCameraView
        remounting={false}
        cameraKey={camera.cameraKeyForMount}
        cameraRef={camera.cameraRef}
        device={device}
        isActive={camera.isActive}
        cameraFps={camera.cameraFpsDuringInit}
        selectedFormat={camera.selectedFormatProp}
        torch={camera.torch}
        // fallow-ignore-next-line complexity
        onInitialized={() => {
          camera.setInitialized(true);
          // lock first viable format to prevent reconfiguration flashes
          camera.setLockedFormat((prev) => prev ?? camera.selectedFormat);
          const fmt = (camera.lockedFormat ?? camera.selectedFormat);
          const dims = fmt ? `${fmt.videoWidth}x${fmt.videoHeight}` : 'unknown';
          const fpsRange = fmt ? `${fmt.minFps}-${fmt.maxFps}` : 'unknown';
          console.log(`[Init ${camera.elapse()}] onInitialized; format=${dims} fpsRange=${fpsRange}; device=${device?.id}`);
        }}
      />
      {!camera.initialized && (
        <View style={styles.spinnerOverlay}>
          <Animated.Image
            source={wheelsSpinAsset}
            style={{ width: 200, height: 200, opacity: 0.2, transform: [{ rotate: camera.spin }] }}
            resizeMode="contain"
          />
          <Text style={styles.loadingLabel}>Initializing camera…</Text>
          <TouchableOpacity style={[styles.bottomButton, { marginTop: 16 }]} onPress={camera.handleRetryInit}>
            <Text style={styles.bottomButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.backButtonContainer, { top: insets.top + 10, left: insets.left + 10 }]}>
        <BackButton onPress={camera.handleBack} />
      </View>

      {camera.initialized && (
        <>
          {/* Top readouts */}
          <View style={[styles.centerPanel, { top: insets.top + 12 }]}>
            <Text style={styles.hzReadout}>
              {(camera.effectiveFps ?? camera.appliedHz).toFixed(2)}{" "}
              <Text style={{ fontSize: 18 }}>Hz</Text>
            </Text>
            <Text style={styles.rpmText}>RPM: {camera.rpm.toFixed(0)}</Text>
          </View>

          {/* Short flashing-images toast */}
          {camera.showFlashToast && (
            <Animated.View
              style={[
                styles.flashToast,
                {
                  top: insets.top + 64,
                  opacity: camera.flashToastOpacity,
                  transform: [
                    {
                      translateY: camera.flashToastOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.flashToastText}>Warning: flashing images</Text>
            </Animated.View>
          )}

          {/* Bottom slider with discrete supported stops */}
          {camera.sliderOptions.length > 0 && (
            <View style={[styles.sliderContainer, { bottom: 48 + insets.bottom }]}> 
              <Text style={styles.sliderLabel}>Adjust Hz</Text>
              <Slider
                style={{ width: "80%", height: 40 }}
                minimumValue={0}
                maximumValue={Math.max(0, camera.sliderOptions.length - 1)}
                step={1}
                value={camera.sliderIndex}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                onValueChange={(val) => {
                  const idx = Math.round(val);
                  const next = camera.sliderOptions[idx] ?? camera.sliderOptions[camera.sliderOptions.length - 1];
                  camera.setRequestedHz(next);
                }}
                onSlidingComplete={(val) => {
                  const idx = Math.round(val);
                  const next = camera.sliderOptions[idx] ?? camera.sliderOptions[camera.sliderOptions.length - 1];
                  camera.setRequestedHz(next);
                }}
              />
            </View>
          )}

          {/* Exposure control: manual shutter slider */}
          {camera.expMinNs != null && camera.expMaxNs != null && (
            <View style={[styles.sliderContainer, { bottom: 120 + insets.bottom }]}> 
              <Text style={styles.sliderLabel}>Exposure</Text>
              <Slider
                style={{ width: "80%", height: 40 }}
                minimumValue={camera.expMinClamp}
                maximumValue={camera.expMaxClamp}
                value={
                  camera.expNs ?? Math.max(camera.expMinClamp, Math.min(camera.expMaxClamp, 700000))
                }
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                onValueChange={(val) => {
                  const v = Math.max(camera.expMinClamp, Math.min(camera.expMaxClamp, Math.round(val)));
                  camera.setExpNs(v);
                }}
                onSlidingComplete={(val) => {
                  const v = Math.max(camera.expMinClamp, Math.min(camera.expMaxClamp, Math.round(val)));
                  camera.applyExposure(v);
                }}
              />
              {/* Exposure numeric readout removed per request */}
            </View>
          )}

          {/* Removed native-only fine detune UI */}

          {/* Bottom bar: modes, torch, back */}
          <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}> 
            <TouchableOpacity
              style={styles.bottomButton}
              onPress={() => camera.setDriftMode((v) => !v)}
            >
              <Text style={styles.bottomButtonText}>{camera.driftMode ? "Drift: On" : "Drift: Off"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomButton}
              onPress={() => camera.setTorch((t) => (t === "on" ? "off" : "on"))}
            >
              <Text style={styles.bottomButtonText}>{camera.torch === "on" ? "Torch On" : "Torch Off"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
 
  },
  backButtonContainer: {
    position: "absolute",
    top: 25,
    left: 25,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
    zIndex: 1000,
  },
  centerPanel: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-around",
    left: 0,
    right: 0,
    height:80,  
  },
  hzReadout: {
    color: "white",
    fontWeight: "800",
    fontSize: 28,
  },
  hzSubLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  rpmText: { color: "white",  fontSize: 14, fontWeight: "700", marginBottom: 20 },
  sliderContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 12,
    paddingVertical: 10,
  },
  exposureReadout: {
    color: "white",
    fontSize: 12,
    opacity: 0.85,
    marginTop: 6,
  },
  exposureButtonsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sliderLabel: {
    color: "white",
    fontWeight: "700",
    textAlign: "center",
  },
  sliderValue: {
    color: "white",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  flashToast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  flashToastText: {
    color: "#ff9900",
    fontWeight: "800",
    letterSpacing: 0.25,
  },
  bottomBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  bottomButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bottomButtonText: { color: "white", fontWeight: "700" },
  permissionText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    marginTop: 300,
  },
  permissionButton: {
    backgroundColor: "#a5d4a5",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "center",
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  spinnerWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 1000,
    elevation: 10,
  },
  loadingLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
});
