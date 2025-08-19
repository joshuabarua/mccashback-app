import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const bottomGap = Math.max(16, Math.min(32, height * 0.04));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1.0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handleVisionCameraPress = () => {
    router.push('/vision-camera');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#fafafa', '#f5f5f5', '#eeeeee']}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + bottomGap + 100 },
          ]}
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

            <Text style={styles.footer}>
              Where automation meets artistry in perpetual motion
            </Text>
          </View>
        </ScrollView>

        {/* Bottom-anchored button */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + bottomGap,
            alignItems: 'center',
          }}
        >
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <TouchableOpacity
              style={[styles.strobeButton, { backgroundColor: '#6b6bff' }]}
              onPress={handleVisionCameraPress}
            >
              <Ionicons name="eye" size={36} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </View>
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
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  content: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 20,
  },
  artistName: {
    fontSize: 24,
    fontWeight: '300',
    color: '#4a4a4a',
    letterSpacing: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#5a5a5a',
    textAlign: 'center',
    letterSpacing: 1,
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    padding: 24,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: '#6a6a6a',
    textAlign: 'center',
  },
  
  strobeButton: {
    backgroundColor: '#4a4a4a',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#3a3a3a',
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
