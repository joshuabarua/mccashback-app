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
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#e8e2f0', '#d4c4e0', '#c0a6d0']}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.artistName}>Angus Greenhalgh</Text>
            <Text style={styles.title}>Automation in D Minor</Text>
            
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                ✨ A generative sound sculpture that creates an infinite composition through the interplay of mechanical automation and digital processing. Each moment is unique, born from the tension between predictable patterns and chaotic emergence.
              </Text>
            </View>

            <View style={styles.techInfo}>
              <Text style={styles.techText}>
                Over 10 billion possible combinations ensure that no two experiences are identical, making each encounter with the installation a singular moment in an endless musical journey.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.strobeButton} 
              onPress={handleCameraPress}
            >
              <Ionicons name="camera" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.strobeButtonText}>Access Strobe Control</Text>
            </TouchableOpacity>

            <Text style={styles.footer}>
              Where automation meets artistry in perpetual motion
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    alignItems: 'center',
    paddingTop: 80,
  },
  artistName: {
    fontSize: 24,
    fontWeight: '300',
    color: '#4a4a4a',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#5a5a5a',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 30,
  },
  descriptionContainer: {
    marginBottom: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6a6a6a',
    textAlign: 'center',
  },
  techInfo: {
    marginBottom: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  techText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#7a7a7a',
    textAlign: 'center',
  },
  strobeButton: {
    backgroundColor: '#b8a8c8',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#a098b8',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 10,
  },
  strobeButtonText: {
    color: '#4a4a4a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  footer: {
    textAlign: 'center',
    color: '#cccccc',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
