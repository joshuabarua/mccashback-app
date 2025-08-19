import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LogBox, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';


import { useColorScheme } from '@/hooks/useColorScheme';

// Silence noisy dev warning from Reanimated
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered.']);

// Keep the native splash visible while we run our JS animation (native only).
if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync();
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Simple spinning + fade-out overlay
  const [showSplash, setShowSplash] = useState(true);
  const rotate = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loaded) return;
    // Ensure starting values each mount
    rotate.setValue(0);
    fade.setValue(1);
    progress.setValue(0);

    // Hide native splash first so our overlay is visible
    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }

    // Single spin + progress, then fade out and remove overlay
    Animated.parallel([
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        // width uses layout updates; cannot use native driver
        useNativeDriver: false,
      }),
    ]).start(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    });
  }, [loaded, rotate, fade, progress]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="vision-camera" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          {showSplash && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: fade,
                  // brand background so home screen waits behind the overlay
                  backgroundColor: '#ff5500',
                },
              ]}
            >
              <Animated.Image
                source={require('../assets/images/splash-icon.png')}
                resizeMode="contain"
                style={{
                  width: 120,
                  height: 120,
                  transform: [
                    {
                      rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                    },
                  ],
                }}
              />
              {/* lightweight progress bar */}
              <Animated.View
                style={{
                  marginTop: 16,
                  width: 160,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.35)',
                  overflow: 'hidden',
                }}
              >
                <Animated.View
                  style={{
                    height: 4,
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
                    backgroundColor: '#fff',
                  }}
                />
              </Animated.View>
            </Animated.View>
          )}
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
