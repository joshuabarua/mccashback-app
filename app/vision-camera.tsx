import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

interface Point {
  x: number;
  y: number;
}

export default function VisionCameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  // Camera states
  const [isActive, setIsActive] = useState(true);
  const [isStrobing, setIsStrobing] = useState(false);
  const [rpm, setRpm] = useState(500);
  const [flashOn, setFlashOn] = useState(false);
  const [activeSlider, setActiveSlider] = useState<'strobe' | null>(null);
  const [focusPoint, setFocusPoint] = useState<Point | null>(null);
  
  const strobeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Strobe effect logic
  useEffect(() => {
    if (isStrobing) {
      const interval = 60000 / rpm; // Convert RPM to milliseconds
      strobeIntervalRef.current = setInterval(() => {
        setFlashOn(prev => !prev);
      }, interval);
    } else {
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
        strobeIntervalRef.current = null;
      }
      setFlashOn(false);
    }

    return () => {
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
      }
    };
  }, [isStrobing, rpm]);

  // Manual focus function
  const focus = useCallback((point: Point) => {
    const camera = cameraRef.current;
    if (camera == null) return;
    
    try {
      camera.focus(point);
      setFocusPoint(point);
      
      // Clear focus point after 2 seconds
      setTimeout(() => {
        setFocusPoint(null);
      }, 2000);
    } catch (error) {
      console.log('Focus failed:', error);
    }
  }, []);

  // Tap gesture for manual focus
  const tapGesture = Gesture.Tap()
    .onEnd(({ x, y }) => {
      runOnJS(focus)({ x, y });
    });

  const toggleStrobe = () => {
    setIsStrobing(!isStrobing);
  };

  const handleRpmChange = (value: number) => {
    setRpm(value);
  };

  const toggleStrobeSlider = () => {
    setActiveSlider(activeSlider === 'strobe' ? null : 'strobe');
  };

  const handleBack = () => {
    setIsActive(false);
    router.back();
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={tapGesture}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={isActive}
          torch={flashOn ? 'on' : 'off'}
        />
      </GestureDetector>

      {/* Focus indicator */}
      {focusPoint && (
        <View 
          style={[
            styles.focusIndicator,
            {
              left: focusPoint.x - 25,
              top: focusPoint.y - 25,
            }
          ]}
        />
      )}

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      {/* Control overlay */}
      <BlurView
        intensity={20}
        tint="dark"
        style={styles.controlsOverlay}
      >
        {/* Control Icons Row */}
        <View style={styles.iconRow}>
          {/* Power Button for Strobe */}
          <TouchableOpacity 
            style={[
              styles.iconButton,
              { backgroundColor: isStrobing ? '#ff6b6b' : 'rgba(255, 255, 255, 0.2)' }
            ]} 
            onPress={toggleStrobe}
          >
            <Ionicons 
              name="power" 
              size={24} 
              color={isStrobing ? "white" : "#cccccc"} 
            />
          </TouchableOpacity>

          {/* Strobe RPM Icon */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: activeSlider === 'strobe' ? '#a5d4a5' : 'rgba(255, 255, 255, 0.2)' }
            ]}
            onPress={toggleStrobeSlider}
          >
            <Ionicons name="flashlight" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Contextual Sliders */}
        {activeSlider === 'strobe' && (
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Strobe RPM: {rpm}</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={1000}
              value={rpm}
              onValueChange={handleRpmChange}
              minimumTrackTintColor="#a5d4a5"
              maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
            />
          </View>
        )}

        {/* Focus instruction */}
        <Text style={styles.instructionText}>
          Tap anywhere on screen to focus
        </Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  focusIndicator: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#a5d4a5',
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    padding: 10,
    zIndex: 1000,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 30,
    paddingBottom: 50,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 30,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sliderContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  sliderLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: '500',
  },
  slider: {
    width: 250,
    height: 40,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#a5d4a5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});
