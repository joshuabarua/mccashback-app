import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    KEY_BMAC_DISABLED,
    KEY_BMAC_LAST_PROMPT,
    useSupportModal
} from '@/hooks/useSupportModal';

// fallow-ignore-next-line complexity
export default function HomeScreen() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const bottomGap = Math.max(16, Math.min(32, height * 0.04));

  // Buy Me a Coffee modal state and constants
  const BMAC_URL = 'https://buymeacoffee.com/mccashback';
  const [showSupportModal, setShowSupportModal] = useSupportModal();
  const [showWarning, setShowWarning] = useState(true);

  // Slow-spinning wheels background
  const bgSpin = useRef(new Animated.Value(0)).current;
  const bgRotate = bgSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Fade-in for text content
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(24)).current;
  // Wink animation for eye icon
  const winkScaleY = useRef(new Animated.Value(1)).current;

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

  // Occasionally wink the eye icon (compress vertically briefly)
  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = 4000 + Math.random() * 6000; // 4–10s
      timeout = setTimeout(() => {
        Animated.sequence([
          Animated.timing(winkScaleY, { toValue: 0.15, duration: 90, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(winkScaleY, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start(() => {
          if (mounted) schedule();
        });
      }, delay);
    };
    schedule();
    return () => { mounted = false; if (timeout) clearTimeout(timeout); };
  }, [winkScaleY]);

  // Show flashing images warning for 10 seconds on home focus
  useFocusEffect(
    useCallback(() => {
      setShowWarning(true);
      const id = setTimeout(() => setShowWarning(false), 10_000);
      return () => clearTimeout(id);
    }, [])
  );

  const handleSupportNow = async () => {
    try {
      await AsyncStorage.setItem(KEY_BMAC_DISABLED, '1');
    } catch {}
    setShowSupportModal(false);
    try {
      await Linking.openURL(BMAC_URL);
    } catch {}
  };

  const handleNotNow = async () => {
    try {
      await AsyncStorage.setItem(KEY_BMAC_LAST_PROMPT, String(Date.now()));
    } catch {}
    setShowSupportModal(false);
  };

  const handleDontShow = async () => {
    try {
      await AsyncStorage.setItem(KEY_BMAC_DISABLED, '1');
    } catch {}
    setShowSupportModal(false);
  };

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
        {/* Support modal (Android only - iOS restricted per App Store guidelines 3.1.1) */}
        {Platform.OS !== 'ios' && (
          <Modal
            transparent
            visible={showSupportModal}
            animationType="fade"
            onRequestClose={() => setShowSupportModal(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowSupportModal(false)}>
              <View style={styles.modalCard} pointerEvents="box-none">
                <View style={{ alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="cafe" size={28} color="#FFDD00" />
                </View>
                <Text style={styles.modalTitle}>Buy me a coffee?</Text>
                <Text style={styles.modalBody}>
                  Hi! I&apos;m a solo artist and musician. If you like what you see,
                  consider buying me a coffee to support my art via the link below.
                </Text>
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleNotNow}>
                    <Text style={styles.modalBtnSecondaryText}>Not now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSupportNow}>
                    <View style={styles.modalBtnContent}>
                      <Ionicons name="cafe" size={18} color="#FFDD00" />
                      <Text style={[styles.modalBtnPrimaryText, { marginLeft: 6 }]}>Buy me a coffee</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleDontShow} style={styles.modalDontShowLink}>
                  <Text style={styles.modalDontShowText}>Don&apos;t show again</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        )}
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
            { paddingBottom: insets.bottom + bottomGap + 50 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            <Text style={styles.artistName}>Angus Greenhalgh</Text>
            <Text style={styles.title}>
              <Text style={styles.titleMain}>Automation</Text>
              {"\n"}
              <Text style={styles.titleIn}>in</Text>
              {"\n"}
              <Text style={styles.titleMinor}>D Minor</Text>
            </Text>

            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                A living sound artwork that constantly rewrites itself.
                Every moment is unique, a balance of rhythm, randomness, and discovery.
              </Text>
            </View>

            <Text style={styles.sliderHint}>
              Use the sliders to explore hidden layers.
            </Text>

            {/* Flashing images warning (auto-hides after 10s) */}
            {showWarning && (
              <View style={styles.warningRow}>
                <Ionicons name="warning" size={16} color="#ff9900" />
                <Text style={styles.warningText}>
                  This app may display flashing images.
                </Text>
              </View>
            )}

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
              style={[styles.strobeButton, { backgroundColor: '#C7C2FF' }]}
              onPress={handleVisionCameraPress}
            >
              <Animated.View style={{ transform: [{ scaleY: winkScaleY }] }}>
                <Ionicons name="eye" size={36} color="white" />
              </Animated.View>
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
    paddingTop: 80,
    gap: 25,
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
    fontWeight: '400',
    color: '#5a5a5a',
    textAlign: 'center',
    letterSpacing: 4,
    lineHeight: 36,
    width: '90%',
  

  },
  titleMain: {
    fontSize: 32,
    fontWeight: '400',
    color: '#5a5a5a',
    letterSpacing: 5,
  },
  titleIn: {
    fontSize: 22,
    fontWeight: '400',
    color: '#5a5a5a',
    letterSpacing: 2,
    lineHeight: 24,
    },
  titleMinor: {
    fontSize: 28,
    fontWeight: '400',
    color: '#5a5a5a',
    letterSpacing: 3,
    lineHeight: 32,
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
    marginTop: -8,
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
  warningRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  warningText: {
    color: '#ff9900',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalBtnPrimary: {
    backgroundColor: '#6b6bff',
  },
  modalBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    color: 'white',
    fontWeight: '800',
  },
  modalBtnSecondary: {
    backgroundColor: '#ededed',
  },
  modalBtnSecondaryText: {
    color: '#333',
    fontWeight: '700',
  },
  modalDontShowLink: {
    marginTop: 10,
    alignSelf: 'center',
  },
  modalDontShowText: {
    color: '#7a7a7a',
    fontSize: 12,
    textDecorationLine: 'underline',
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
