/**
 * Layout principal de l'application (Expo Router)
 */

import { Stack } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { hasLocationPermission } from '../services/location';
import { useLocationStore } from '../stores/useLocationStore';
import { useAppTheme } from '../services/settingsTheme';
import { useSettingsStore } from '../stores/useSettingsStore';
import { clearSavedExpoPushToken, ensureNotificationHandler, registerForExpoPushToken } from '../services/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnMount: false,
      // Avoid "spam" refetch when network flaps; we prefer explicit refresh.
      refetchOnReconnect: false,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'nearplace:rq',
  throttleTime: 1000,
});

export default function RootLayout() {
  const setHasPermission = useLocationStore((s) => s.setHasPermission);
  const t = useAppTheme();
  const notifPrefs = useSettingsStore((s) => s.notifications);

  useEffect(() => {
    // Always keep permission state in sync (store is not persisted).
    hasLocationPermission().then((g) => setHasPermission(g));
  }, [setHasPermission]);

  useEffect(() => {
    // Configure notifications early (needed for build + local tests).
    ensureNotificationHandler();
    if (!notifPrefs.enabled) {
      void clearSavedExpoPushToken();
      return;
    }
    // Register lazily; failure should not crash the app.
    void registerForExpoPushToken().catch(() => {});
  }, [notifPrefs.enabled]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Keep cached results longer so establishments stay available offline.
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      }}
    >
      <SafeAreaProvider>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          {/* Public onboarding */}
          <Stack.Screen name="(public)" />

          {/* App (tabs) */}
          <Stack.Screen name="(app)" />

          {/* Settings are pushed above tabs (not part of bottom navigation). */}
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />

          {/* Pro dashboard (opened from Pro settings). */}
          <Stack.Screen name="business-dashboard" options={{ animation: 'slide_from_right' }} />

          {/* Admin (moderation) */}
          <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />

          {/* Details + navigation are pushed above tabs */}
          <Stack.Screen name="establishment/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="navigation" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}


