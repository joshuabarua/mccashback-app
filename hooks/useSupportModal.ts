import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

export const KEY_BMAC_DISABLED = 'support.bmac.disabled';
export const KEY_BMAC_LAST_PROMPT = 'support.bmac.lastPrompt';
const KEY_BMAC_LAUNCH_COUNT = 'support.bmac.launchCount';
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowSupportModal(
  disabled: string | null,
  count: number,
  lastPromptMs: number | null,
  now: number,
): boolean {
  if (disabled === '1') return false;
  if (count <= 2) return true;
  if (!lastPromptMs) return true;
  return now - lastPromptMs > ONE_WEEK_MS;
}

export function useSupportModal(): [boolean, (show: boolean) => void] {
  const [showSupportModal, setShowSupportModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Disable Buy Me a Coffee on iOS per Apple App Store guidelines (3.1.1)
      if (Platform.OS === 'ios') return;

      let active = true;
      (async () => {
        try {
          const disabled = await AsyncStorage.getItem(KEY_BMAC_DISABLED);
          const rawCount = await AsyncStorage.getItem(KEY_BMAC_LAUNCH_COUNT);
          const last = await AsyncStorage.getItem(KEY_BMAC_LAST_PROMPT);
          let count = parseInt(rawCount ?? '0', 10) || 0;
          count += 1;
          await AsyncStorage.setItem(KEY_BMAC_LAUNCH_COUNT, String(count));
          const lastMs = last ? parseInt(last, 10) || 0 : null;
          if (shouldShowSupportModal(disabled, count, lastMs, Date.now())) {
            if (active) setShowSupportModal(true);
          }
        } catch {}
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return [showSupportModal, setShowSupportModal];
}
