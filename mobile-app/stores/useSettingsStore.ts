import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TextSize = 'normal' | 'large';
export type UiDensity = 'standard' | 'compact';
export type TravelMode = 'driving' | 'walking' | 'bicycling';
export type MapTypePref = 'standard' | 'satellite';

type NotificationsPrefs = {
  enabled: boolean;
  establishmentActivity: boolean;
  systemUpdates: boolean;
  tips: boolean;
};

type SettingsState = {
  // Account/security local prefs (no backend)
  hideMyEstablishmentsOnThisDevice: boolean;

  // Notifications (local persistence; backend sync can be added later)
  notifications: NotificationsPrefs;

  // Appearance
  themeMode: ThemeMode;
  textSize: TextSize;
  density: UiDensity;

  // Navigation preferences
  defaultTravelMode: TravelMode;

  // Map preferences
  mapType: MapTypePref;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setTextSize: (size: TextSize) => void;
  setDensity: (density: UiDensity) => void;
  setDefaultTravelMode: (mode: TravelMode) => void;
  setMapType: (type: MapTypePref) => void;
  setNotification: (key: keyof NotificationsPrefs, value: boolean) => void;
  setHideMyEstablishmentsOnThisDevice: (value: boolean) => void;
  reset: () => void;
};

const DEFAULTS: Pick<
  SettingsState,
  | 'hideMyEstablishmentsOnThisDevice'
  | 'notifications'
  | 'themeMode'
  | 'textSize'
  | 'density'
  | 'defaultTravelMode'
  | 'mapType'
> = {
  hideMyEstablishmentsOnThisDevice: false,
  notifications: {
    enabled: true,
    establishmentActivity: true,
    systemUpdates: true,
    tips: true,
  },
  themeMode: 'system',
  textSize: 'normal',
  density: 'standard',
  defaultTravelMode: 'driving',
  // Recommended: roadmap by default.
  mapType: 'standard',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      setThemeMode: (themeMode) => set({ themeMode }),
      setTextSize: (textSize) => set({ textSize }),
      setDensity: (density) => set({ density }),
      setDefaultTravelMode: (defaultTravelMode) => set({ defaultTravelMode }),
      setMapType: (mapType) => set({ mapType }),
      setHideMyEstablishmentsOnThisDevice: (hideMyEstablishmentsOnThisDevice) => set({ hideMyEstablishmentsOnThisDevice }),

      setNotification: (key, value) => {
        const prev = get().notifications;
        set({ notifications: { ...prev, [key]: value } });
      },

      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'nearplace:settings:v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);



