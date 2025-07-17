import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';



export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [isStrobing, setIsStrobing] = useState(false);
  const [rpm, setRpm] = useState(500);
  const [flashOn, setFlashOn] = useState(false);
  const [activeSlider, setActiveSlider] = useState<'strobe' | null>(null);
  const cameraRef = useRef<any>(null);
  const strobeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  useEffect(() => {
    return () => {
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
      }
    };
  }, []);

  // Update strobe interval in real-time when RPM changes while strobing
  useEffect(() => {
    if (isStrobing && strobeIntervalRef.current) {
      // Clear current interval
      clearInterval(strobeIntervalRef.current);
      
      // Start new interval with updated RPM
      strobeIntervalRef.current = setInterval(() => {
        setFlashOn(prev => !prev);
      }, calculateStrobeInterval(rpm));
    }
  }, [rpm, isStrobing]);

  const calculateStrobeInterval = (rpm: number): number => {
    // Convert RPM to milliseconds per flash
    return Math.max(60000 / rpm, 10); // Minimum 10ms interval for safety
  };

  const toggleStrobe = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        return;
      }
    }

    if (isStrobing) {
      // Stop strobe
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
        strobeIntervalRef.current = null;
      }
      setFlashOn(false);
      setIsStrobing(false);
    } else {
      // Start strobe
      if (strobeIntervalRef.current) {
        clearInterval(strobeIntervalRef.current);
      }

      strobeIntervalRef.current = setInterval(() => {
        setFlashOn(prev => !prev);
      }, calculateStrobeInterval(rpm));
      setIsStrobing(true);
    }
  };

  const handleStrobeIconPress = () => {
    setActiveSlider(activeSlider === 'strobe' ? null : 'strobe');
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

      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Full-screen Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashOn}
        ref={cameraRef}
      />

      {/* Floating Back Arrow */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      {/* Transparent Blur Overlay for Controls */}
      <BlurView
        intensity={80}
        tint="dark"
        style={styles.controlsContainer}
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
              { backgroundColor: activeSlider === 'strobe' ? '#d4a5a5' : 'rgba(255, 255, 255, 0.2)' }
            ]}
            onPress={handleStrobeIconPress}
          >
            <Ionicons name="flashlight" size={24} color="white" />
          </TouchableOpacity>


        </View>

        {/* Contextual Sliders */}
        {activeSlider === 'strobe' && (
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={500}
              maximumValue={3000}
              step={50}
              value={rpm}
              onValueChange={setRpm}
              minimumTrackTintColor="#a5d4a5"
              maximumTrackTintColor="#d4a5a5"
              thumbTintColor="#ffffff"
            />
          </View>
        )}


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
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  strobeButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  strobeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
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
