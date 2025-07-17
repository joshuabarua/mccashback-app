import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TorchMode = boolean;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState<TorchMode>(false);
  const [isStrobing, setIsStrobing] = useState(false);
  const [rpm, setRpm] = useState(500);
  const cameraRef = useRef<any>(null);
  const strobeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {

    return () => {
      // Cleanup strobe effect on unmount
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
      }
    };
  }, []);



  // Calculate strobe interval in ms from rpm
  const calculateStrobeInterval = (rpm: number) => {
    // RPM to milliseconds: (60 seconds / RPM) * 1000 ms/second
    return Math.floor((60 / rpm) * 1000);
  };

  // Toggle strobe effect
  const toggleStrobe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsStrobing(prev => {
      if (!prev) {
        // Start strobe
        if (strobeIntervalRef.current) {
          clearInterval(strobeIntervalRef.current);
        }

        let isTorchOn = false;
        strobeIntervalRef.current = setInterval(() => {
          isTorchOn = !isTorchOn;
          if (cameraRef.current) {
            setTorchEnabled(isTorchOn);
          }
        }, calculateStrobeInterval(rpm));
        return true;
      } else {
        // Stop strobe
        if (strobeIntervalRef.current) {
          clearInterval(strobeIntervalRef.current);
          strobeIntervalRef.current = null;
        }

        return false;
      }
    });
  };

  // Update strobe rate
  const updateStrobeRate = (newRpm: number) => {
    setRpm(newRpm);
    if (isStrobing && strobeIntervalRef.current) {
      clearInterval(strobeIntervalRef.current);

      let isTorchOn = false;
      strobeIntervalRef.current = setInterval(() => {
        isTorchOn = !isTorchOn;
        if (cameraRef.current) {
          setTorchEnabled(isTorchOn);
        }
      }, calculateStrobeInterval(newRpm));
    }
  };

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleBack}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={torchEnabled}
      />

      {/* UI Controls with absolute positioning */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isStrobing && styles.strobeActiveButton]}
          onPress={toggleStrobe}
        >
          <Text style={styles.buttonText}>
            {isStrobing ? 'STOP STROBE' : 'START STROBE'}
          </Text>
        </TouchableOpacity>

        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Strobe Rate: {rpm} RPM</Text>
          <Slider
            style={styles.slider}
            minimumValue={500}
            maximumValue={3000}
            step={50}
            value={rpm}
            onValueChange={updateStrobeRate}
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="#000000"
            thumbTintColor="#FFFFFF"
          />
        </View>
      </View>
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
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  backButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  indicatorOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicator: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 8,
    marginVertical: 5,
  },
  indicatorText: {
    color: 'white',
    fontWeight: 'bold',
  },
  controlsContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  controlButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  activeButton: {
    backgroundColor: '#1565C0',
  },
  strobeActiveButton: {
    backgroundColor: '#C62828',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sliderContainer: {
    marginTop: 10,
  },
  sliderLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#1565C0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 40,
  },
});
