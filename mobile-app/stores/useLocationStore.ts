/**
 * Store Zustand pour la gestion de la localisation GPS
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates } from '../types/establishment';
import { DEFAULT_LOCATION } from '../services/location';

interface LocationStore {
  // Position actuelle de l'utilisateur
  userLocation: Coordinates | null;
  
  // Permission GPS accordée ?
  hasPermission: boolean;
  
  // Suivi GPS actif ?
  isTracking: boolean;
  
  // Erreur éventuelle
  error: string | null;

  // Actions
  setUserLocation: (location: Coordinates) => void;
  setHasPermission: (granted: boolean) => void;
  setIsTracking: (tracking: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationStore>()(
  persist(
    (set) => ({
      userLocation: null,
      hasPermission: false,
      isTracking: false,
      error: null,

      setUserLocation: (location) => set({ userLocation: location, error: null }),
      setHasPermission: (granted) => set({ hasPermission: granted }),
      setIsTracking: (tracking) => set({ isTracking: tracking }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          userLocation: null,
          hasPermission: false,
          isTracking: false,
          error: null,
        }),
    }),
    {
      name: 'nearplace:locationStore:v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        userLocation: s.userLocation,
        hasPermission: s.hasPermission,
      }),
    },
  ),
);

/**
 * Hook pour obtenir la position actuelle (avec fallback sur position par défaut)
 */
export const useCurrentLocation = (): Coordinates => {
  const userLocation = useLocationStore((state) => state.userLocation);
  return userLocation || DEFAULT_LOCATION;
};


