import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import api from './api';

const KEY_PUSH = 'nearplace:expoPushToken:v1';
const KEY_PUSH_SYNC = 'nearplace:expoPushToken:syncedAt:v1';
const KEY_PUSH_LOC_SYNC = 'nearplace:expoPushToken:locSyncedAt:v1';
const KEY_PUSH_LOC_LAST = 'nearplace:expoPushToken:lastLoc:v1';

let handlerSet = false;

function isExpoGo(): boolean {
  // Covers older + newer SDKs.
  const appOwnership = (Constants as any)?.appOwnership;
  const execEnv = (Constants as any)?.executionEnvironment;
  return appOwnership === 'expo' || execEnv === 'storeClient';
}

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

  // SDK 53+: Expo Go no longer supports remote push notifications on Android (and this call warns noisily).
  // We still support local notifications (scheduleNotificationAsync) without a token.
  if (isExpoGo()) return null;

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
    // Best-effort sync to backend (only works when user is logged in and running a dev build / production app).
    // Avoid spamming: sync at most once per 24h for the same device/session.
    try {
      const last = Number(await AsyncStorage.getItem(KEY_PUSH_SYNC).catch(() => '0')) || 0;
      if (Date.now() - last > 24 * 60 * 60 * 1000) {
        await api
          .post('/api/notifications/push-token', {
            token: token.trim(),
            platform: Platform.OS,
          })
          .catch(() => {});
        await AsyncStorage.setItem(KEY_PUSH_SYNC, String(Date.now())).catch(() => {});
      }
    } catch {
      // ignore
    }
    return token.trim();
  }
  return null;
}

export async function syncExpoPushTokenLocation(params: { lat: number; lng: number }) {
  // Only meaningful when we have a real push token (dev build / production) and the user is logged in.
  const token = await getSavedExpoPushToken();
  if (!token) return;

  const lat = Number(params.lat);
  const lng = Number(params.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  // Throttle: at most every 30 minutes, unless location moved significantly.
  const lastAt = Number(await AsyncStorage.getItem(KEY_PUSH_LOC_SYNC).catch(() => '0')) || 0;
  const lastLocRaw = await AsyncStorage.getItem(KEY_PUSH_LOC_LAST).catch(() => null);
  let movedFar = true;
  try {
    const last = lastLocRaw ? JSON.parse(lastLocRaw) : null;
    if (last && Number.isFinite(Number(last.lat)) && Number.isFinite(Number(last.lng))) {
      const d = Math.hypot((Number(last.lat) - lat) * 111_320, (Number(last.lng) - lng) * 111_320);
      movedFar = d > 600; // >600m
    }
  } catch {
    // ignore
  }
  if (!movedFar && Date.now() - lastAt < 30 * 60 * 1000) return;

  await api
    .post('/api/notifications/push-token', {
      token,
      platform: Platform.OS,
      lat,
      lng,
    })
    .catch(() => {});
  await AsyncStorage.setItem(KEY_PUSH_LOC_SYNC, String(Date.now())).catch(() => {});
  await AsyncStorage.setItem(KEY_PUSH_LOC_LAST, JSON.stringify({ lat, lng })).catch(() => {});
}

export async function scheduleTestNotification(params?: { title?: string; body?: string }) {
  ensureNotificationHandler();
  const title = params?.title || "O'Show — Notification test";
  const body = params?.body || 'Les notifications sont bien configurées ✅';
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' as any },
    trigger: { seconds: 1 },
  });
}


