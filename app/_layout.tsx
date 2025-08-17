import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { Animated, Easing, StyleSheet, Platform } from 'react-native';
import { useEffect, useRef, useState } from 'react';


import { useColorScheme } from '@/hooks/useColorScheme';

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

  useEffect(() => {
    if (!loaded) return;
    // Spin 2x, then fade out and hide the native splash
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { iterations: 2 }
    ).start(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
      });
    });
  }, [loaded, rotate, fade]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="camera" options={{ headerShown: false }} />
          <Stack.Screen name="vision-camera" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        {showSplash && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', opacity: fade }]}
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
          </Animated.View>
        )}
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
