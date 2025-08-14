import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function VisionCameraWebPlaceholder() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons name="desktop-outline" size={48} color="#fff" />
      <Text style={styles.title}>Vision Camera not supported on Web</Text>
      <Text style={styles.subtitle}>
        This screen is implemented using react-native-vision-camera, which requires running on iOS or Android using an Expo Dev Client.
      </Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL('https://docs.expo.dev/development/getting-started/')}
        >
          <Text style={styles.buttonText}>Set up Dev Client</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#bbb',
    fontSize: 14,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primary: {
    backgroundColor: '#1565C0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
