import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';

const KEY_PUSH = 'nearplace:expoPushToken:v1';

let handlerSet = false;

export function ensureNotificationHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getNotificationPermissions() {
  return await Notifications.getPermissionsAsync().catch(() => null as any);
}

export async function requestNotificationPermissions() {
  // Android 13+: request POST_NOTIFICATIONS runtime permission.
  return await Notifications.requestPermissionsAsync().catch(() => null as any);
}

export async function openOsNotificationSettings() {
  await Linking.openSettings();
}

function getProjectId(): string | null {
  const easId = (Constants as any)?.easConfig?.projectId;
  if (typeof easId === 'string' && easId.trim()) return easId.trim();
  const extraId = (Constants.expoConfig as any)?.extra?.eas?.projectId;
  if (typeof extraId === 'string' && extraId.trim() && extraId !== 'YOUR_EAS_PROJECT_ID') return extraId.trim();
  return null;
}

export async function getSavedExpoPushToken(): Promise<string | null> {
  const t = await AsyncStorage.getItem(KEY_PUSH).catch(() => null);
  return t && t.trim() ? t.trim() : null;
}

export async function clearSavedExpoPushToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY_PUSH).catch(() => {});
}

/**
 * Registers (or reuses) an Expo push token.
 * Note: without a backend, this token is only useful for testing/logging.
 */
export async function registerForExpoPushToken(): Promise<string | null> {
  ensureNotificationHandler();

  // Web is not supported.
  if (Platform.OS === 'web') return null;

  const perm = await getNotificationPermissions();
  if (!perm?.granted) {
    const req = await requestNotificationPermissions();
    if (!req?.granted) return null;
  }

  // If already stored, keep it (stable).
  const existing = await getSavedExpoPushToken();
  if (existing) return existing;

  const projectId = getProjectId();
  if (!projectId) {
    // Dev builds can still show local notifications without a push token.
    // For production push, configure expo.extra.eas.projectId.
    return null;
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes?.data ? String(tokenRes.data) : null;
  if (token && token.trim()) {
    await AsyncStorage.setItem(KEY_PUSH, token.trim()).catch(() => {});
    return token.trim();
  }
  return null;
}

export async function scheduleTestNotification(params?: { title?: string; body?: string }) {
  ensureNotificationHandler();
  const title = params?.title || "O'Show — Notification test";
  const body = params?.body || 'Les notifications sont bien configurées ✅';
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { seconds: 1 },
  });
}


