import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleCameraPress = () => {
    router.push('/camera');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#fafafa', '#f5f5f5', '#eeeeee']}
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

              <Text style={styles.techText}>
                Over 10 billion possible combinations ensure that no two experiences are identical, making each encounter with the installation a singular moment in an endless musical journey.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.strobeButton}
              onPress={handleCameraPress}
            >
              <Ionicons name="camera" size={36} color="white" />
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
    backgroundColor: '#4a4a4a',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    marginBottom: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#7a7a7a',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
