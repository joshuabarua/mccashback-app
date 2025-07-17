import { StyleSheet, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const router = useRouter();
  
  const handleCameraPress = () => {
    router.push('/camera');
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.artistName}>Angus Greenhalgh</Text>
            <Text style={styles.installationTitle}>Automation in D Minor</Text>
          </View>

          {/* Main Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.mainDescription}>
              ✨ Automation in D Minor transforms 5 CD players into a generative sound sculpture, 
              creating a constantly evolving, cinematic soundscape without human intervention. 
              Each shuffle becomes part of a living composition, exploring how technology and 
              chance shape music in the age of AI.
            </Text>
            
            <Text style={styles.subDescription}>
              Sound, light, and mechanics merge into an immersive, meditative experience—an 
              orchestra that plays itself.
            </Text>
          </View>

          {/* Technical Info */}
          <View style={styles.technicalContainer}>
            <Text style={styles.technicalTitle}>Infinite Possibilities</Text>
            <Text style={styles.technicalDescription}>
              This installation contains over 10 billion possible combinations, shifting 
              endlessly due to track variations and staggered starts. Even if it ran 
              continuously, it would take tens of thousands of years before a repeat, and 
              with phasing differences, it will realistically never repeat in your lifetime.
            </Text>
          </View>

          {/* Camera Access Button */}
          <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress}>
            <View style={styles.buttonContent}>
              <Ionicons name="camera" size={28} color="#ffffff" />
              <Text style={styles.cameraButtonText}>Access Strobe Control</Text>
            </View>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>An exploration of generative music and automated artistry</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  artistName: {
    fontSize: 18,
    fontWeight: '300',
    color: '#cccccc',
    letterSpacing: 2,
    marginBottom: 8,
  },
  installationTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 1,
  },
  descriptionContainer: {
    marginBottom: 40,
  },
  mainDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '400',
  },
  subDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#b0b0b0',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '300',
  },
  technicalContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  technicalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  technicalDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#d0d0d0',
    textAlign: 'center',
    fontWeight: '400',
  },
  cameraButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 32,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
