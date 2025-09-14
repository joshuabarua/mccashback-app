import BackButton from "@/components/BackButton";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCameraDevice,
  useCameraPermission,
  type Camera,
  type CameraDeviceFormat,
} from "react-native-vision-camera";
import VisionCameraView from "../components/VisionCameraView";
import { useFormatsAndFps } from "../hooks/useFormatsAndFps";
const wheelsSpinAsset = require("../assets/images/wheelsboxes.png");

export default function VisionCameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const insets = useSafeAreaInsets();

  // Strobe method state
  const [isActive, setIsActive] = useState(true);
  const [requestedHz, setRequestedHz] = useState(24);
  const [appliedHz, setAppliedHz] = useState(24);
  const [torch, setTorch] = useState<"on" | "off">("off");
  const [driftMode, setDriftMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Spinner for initializing state
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = useMemo(
    () =>
      spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spinValue]
  );
  useEffect(() => {
    if (!initialized) {
      const loop = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => {
        loop.stop();
        spinValue.setValue(0);
      };
    } else {
      spinValue.setValue(0);
    }
  }, [initialized, spinValue]);

  // Pick a camera format that supports the requested FPS (requestedHz)
  // Always use extended options so the slider can reach lower Hz like the previous +/- buttons.
  const { selectedFormat, effectiveFps, supportedFpsOptions } =
    useFormatsAndFps(device, requestedHz, setAppliedHz, false, true);

  // Lock the first good format after initialization to avoid disruptive reconfiguration
  const [lockedFormat, setLockedFormat] = useState<CameraDeviceFormat | undefined>(undefined);
  useEffect(() => {
    if (!initialized) return;
    if (!lockedFormat && selectedFormat) {
      setLockedFormat(selectedFormat);
    }
  }, [initialized, lockedFormat, selectedFormat]);

  // Use a stable key after init to prevent Camera remounts (which cause a black flash)
  const stableKeyRef = useRef("camera-stable");

  // Retry state to force a remount while initializing
  const [bootNonce, setBootNonce] = useState(0);
  const handleRetryInit = useCallback(() => {
    // Bump key to force a fresh mount
    setBootNonce((n) => n + 1);
  }, []);

  // Keep a stable key before initialization to avoid repeated remounts
  const cameraKeyForMount = useMemo(
    () => (initialized ? stableKeyRef.current : `boot-${bootNonce}`),
    [initialized, bootNonce]
  );

  // Drive Camera fps from the appliedHz (which is constrained to the locked format)
  const cameraFpsProp = appliedHz;

  // Compute props used during initialization without introducing new hooks below early returns
  const selectedFormatProp = initialized ? (lockedFormat ?? selectedFormat) : undefined;
  const cameraFpsDuringInit = initialized ? cameraFpsProp : undefined;

  // Ensure camera permission
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Removed native low-FPS configuration effects

  const handleBack = () => {
    setIsActive(false);
    router.back();
  };

  // Build slider stops from the actual format used by Camera (ensures every stop is supported by that format)
  const formatForStops = useMemo(() => (lockedFormat ?? selectedFormat), [lockedFormat, selectedFormat]);
  const sliderOptions = useMemo(() => {
    const f = formatForStops as CameraDeviceFormat | undefined;
    if (f && typeof f.minFps === "number" && typeof f.maxFps === "number") {
      const min = Math.max(1, Math.ceil(f.minFps as number));
      const max = Math.max(min, Math.floor(f.maxFps as number));
      const arr: number[] = [];
      for (let v = min; v <= max; v++) arr.push(v);
      return arr;
    }
    const list = (supportedFpsOptions || []).slice().sort((a, b) => a - b);
    return list.length ? list : [requestedHz];
  }, [formatForStops, supportedFpsOptions, requestedHz]);
  const sliderIndex = useMemo(() => {
    if (!sliderOptions.length) return 0;
    const idx = sliderOptions.reduce((bestIdx, val, idx) => {
      return Math.abs(val - requestedHz) <
        Math.abs(sliderOptions[bestIdx] - requestedHz)
        ? idx
        : bestIdx;
    }, 0);
    return idx;
  }, [sliderOptions, requestedHz]);

  const rpm = useMemo(() => {
    const hzVal = Number.isFinite(effectiveFps) ? effectiveFps : appliedHz;
    return hzVal * 60; // divisor fixed to 1
  }, [effectiveFps, appliedHz]);

  // Debounce applying requestedHz to the camera (snap to nearest supported option from the active Camera format)
  useEffect(() => {
    if (!initialized) return;
    if (driftMode) return; // drift loop controls appliedHz
    const t = setTimeout(() => {
      const options =
        sliderOptions && sliderOptions.length ? sliderOptions : [requestedHz];
      const nearest = options.reduce(
        (p, c) =>
          Math.abs(c - requestedHz) < Math.abs(p - requestedHz) ? c : p,
        options[0]
      );
      if (nearest !== appliedHz) setAppliedHz(nearest);
    }, 500);
    return () => clearTimeout(t);
  }, [initialized, requestedHz, sliderOptions, appliedHz, driftMode]);

  // Drift mode: oscillate appliedHz between neighbor supported stops (every ~2s) to create slow movement when frozen
  useEffect(() => {
    if (!initialized) return;
    if (!driftMode) return;
    if (!sliderOptions.length) return;
    let i = 0;
    const options = sliderOptions.slice().sort((a, b) => a - b);
    // find neighbors around requestedHz
    const idx = options.reduce(
      (bestIdx, val, idx) =>
        Math.abs(val - requestedHz) < Math.abs(options[bestIdx] - requestedHz)
          ? idx
          : bestIdx,
      0
    );
    const lower = Math.max(0, idx - 1);
    const upper = Math.min(options.length - 1, idx + 1);
    const seq =
      lower === upper ? [options[idx]] : [options[lower], options[upper]];
    const interval = setInterval(() => {
      const next = seq[i % seq.length];
      i++;
      if (next !== appliedHz) setAppliedHz(next);
    }, 2000);
    return () => clearInterval(interval);
  }, [
    driftMode,
    sliderOptions,
    requestedHz,
    appliedHz,
    initialized,
  ]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.spinnerWrapper}>
          <Animated.Image
            source={wheelsSpinAsset}
            style={{ width: 160, height: 160, opacity: 0.2, transform: [{ rotate: spin }] }}
            resizeMode="contain"
          />
        </View>
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
        <View style={styles.spinnerWrapper}>
          <Animated.Image
            source={wheelsSpinAsset}
            style={{ width: 160, height: 160, opacity: 0.2, transform: [{ rotate: spin }] }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VisionCameraView
        remounting={false}
        cameraKey={cameraKeyForMount}
        cameraRef={cameraRef}
        device={device}
        isActive={isActive}
        cameraFps={cameraFpsDuringInit}
        selectedFormat={selectedFormatProp}
        torch={torch}
        onInitialized={() => {
          setInitialized(true);
          // lock first viable format to prevent reconfiguration flashes
          setLockedFormat((prev) => prev ?? selectedFormat);
          console.log("initialized");
        }}
      />
      {!initialized && (
        <View style={styles.spinnerOverlay}>
          <Animated.Image
            source={wheelsSpinAsset}
            style={{ width: 200, height: 200, opacity: 0.2, transform: [{ rotate: spin }] }}
            resizeMode="contain"
          />
          <Text style={styles.loadingLabel}>Initializing camera…</Text>
          <TouchableOpacity style={[styles.bottomButton, { marginTop: 16 }]} onPress={handleRetryInit}>
            <Text style={styles.bottomButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.backButtonContainer, { top: insets.top + 10, left: insets.left + 10 }]}>
        <BackButton onPress={handleBack} />
      </View>

      {initialized && (
        <>
          {/* Middle readouts */}
          <View style={[styles.centerPanel, { bottom: insets.bottom + 120 }]}>
            <Text style={styles.hzReadout}>
              {(effectiveFps ?? appliedHz).toFixed(2)}{" "}
              <Text style={{ fontSize: 18 }}>Hz</Text>
            </Text>
            <Text style={styles.rpmText}>RPM: {rpm.toFixed(0)}</Text>
          </View>

          {/* Bottom slider with discrete supported stops */}
          {sliderOptions.length > 0 && (
            <View style={[styles.sliderContainer, { bottom: 48 + insets.bottom }]}> 
              <Text style={styles.sliderLabel}>Adjust Hz</Text>
              <Slider
                style={{ width: "80%", height: 40 }}
                minimumValue={0}
                maximumValue={Math.max(0, sliderOptions.length - 1)}
                step={1}
                value={sliderIndex}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                onValueChange={(val) => {
                  const idx = Math.round(val);
                  const next = sliderOptions[idx] ?? sliderOptions[sliderOptions.length - 1];
                  setRequestedHz(next);
                }}
                onSlidingComplete={(val) => {
                  const idx = Math.round(val);
                  const next = sliderOptions[idx] ?? sliderOptions[sliderOptions.length - 1];
                  setRequestedHz(next);
                }}
              />
            </View>
          )}

          {/* Removed native-only fine detune UI */}

          {/* Bottom bar: modes, torch, back */}
          <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}> 
            <TouchableOpacity
              style={styles.bottomButton}
              onPress={() => setDriftMode((v) => !v)}
            >
              <Text style={styles.bottomButtonText}>{driftMode ? "Drift: On" : "Drift: Off"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomButton}
              onPress={() => setTorch((t) => (t === "on" ? "off" : "on"))}
            >
              <Text style={styles.bottomButtonText}>{torch === "on" ? "Torch On" : "Torch Off"}</Text>
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
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
