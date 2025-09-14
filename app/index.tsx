import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useCallback } from 'react';
import { Animated, Easing, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const bottomGap = Math.max(16, Math.min(32, height * 0.04));

  // Slow-spinning wheels background
  const bgSpin = useRef(new Animated.Value(0)).current;
  const bgRotate = bgSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Fade-in for text content
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(24)).current;

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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bgSpin, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      bgSpin.setValue(0);
    };
  }, [bgSpin]);

  useFocusEffect(
    useCallback(() => {
      // Reset starting values on focus so animation always plays
      textOpacity.setValue(0);
      textTranslateY.setValue(24);
      const anim = Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 1100,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 1100,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      anim.start();
      return () => anim.stop();
    }, [textOpacity, textTranslateY])
  );

  const handleVisionCameraPress = () => {
    router.push('/vision-camera');
  };

  const handleOpenInstagram = async () => {
    const appUrl = 'instagram://user?username=angusgreenhalgh';
    const webUrl = 'https://instagram.com/angusgreenhalgh';
    try {
      const supported = await Linking.canOpenURL(appUrl);
      await Linking.openURL(supported ? appUrl : webUrl);
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#fafafa', '#f5f5f5', '#eeeeee']}
        style={styles.container}
      >
        {/* Faded, slow-spinning background icon */}
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <Animated.Image
            source={require('../assets/images/adaptive-icon2.png')}
            style={[
              styles.bgSpinImage,
              {
                width: Math.max(width, height) * 1.2,
                height: Math.max(width, height) * 1.2,
                top: (height - Math.max(width, height) * 1.2) / 2,
                left: (width - Math.max(width, height) * 1.2) / 2,
                transform: [{ rotate: bgRotate }],
              },
            ]}
            resizeMode="contain"
          />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + bottomGap + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            <Text style={styles.artistName}>Angus Greenhalgh</Text>
            <Text style={styles.title}>Automation in D Minor</Text>

            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                 A generative sound sculpture that creates an infinite composition through the interplay of mechanical automation and digital processing. Each moment is unique, born from the tension between predictable patterns and chaotic emergence.
              </Text>
            </View>

            <Text style={styles.footer}>
              Where automation meets artistry in perpetual motion
            </Text>

            <Text style={styles.sliderHint}>
              Adjust the sliders to watch an ever‑changing display of images emerge.
            </Text>

            <TouchableOpacity style={styles.socialRow} onPress={handleOpenInstagram} activeOpacity={0.7}>
              <Ionicons name="logo-instagram" size={20} color="#E1306C" />
              <Text style={styles.socialText}>@angusgreenhalgh</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>

        {/* Bottom-anchored button */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: Math.max(0, insets.bottom + bottomGap - 20),
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
  bgSpinImage: {
    position: 'absolute',
    opacity: 0.1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  content: {
    alignItems: 'center',
    paddingTop: 90,
    gap: 30,
  },
  artistName: {
    fontSize: 22,
    fontWeight: '300',
    color: '#4a4a4a',
    letterSpacing: 4,
    textDecorationLine: 'underline',
    textDecorationStyle: 'double',
    textDecorationColor: 'black',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 40,
    color: '#5a5a5a',
    textAlign: 'center',
    letterSpacing: 1,
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: '#131313',
    fontWeight: '600',
    textAlign: 'center',
  },
  socialRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialText: {
    color: '#2b2b2b',
    fontSize: 16,
    fontWeight: '600',
  },
  sliderHint: {
    marginTop: 10,
    textAlign: 'center',
    color: '#6a6a6a',
    fontSize: 13,
    lineHeight: 18,
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
    letterSpacing: 2,
    lineHeight: 20,
    fontWeight: '400',
  

  },
});
