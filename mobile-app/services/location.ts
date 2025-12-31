/**
 * Service de géolocalisation GPS
 * Utilise Expo Location
 */

import * as Location from 'expo-location';
import { Coordinates } from '../types/establishment';

// Position par défaut: Abidjan, Côte d'Ivoire
export const DEFAULT_LOCATION: Coordinates = {
  lat: 5.3261,
  lng: -4.0200,
};

/**
 * Demande la permission de géolocalisation à l'utilisateur
 */
export async function requestLocationPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      error: status !== 'granted' ? 'Permission refusée' : undefined,
    };
  } catch (error: any) {
    return {
      granted: false,
      error: error.message || 'Erreur lors de la demande de permission',
    };
  }
}

/**
 * Demande la permission de géolocalisation en arrière-plan (nécessaire pour suivre pendant la navigation)
 * ⚠️ Sur iOS/Android, cela nécessite un build (Expo Go a des limitations).
 */
export async function requestBackgroundLocationPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return {
      granted: status === 'granted',
      error: status !== 'granted' ? 'Permission arrière-plan refusée' : undefined,
    };
  } catch (error: any) {
    return {
      granted: false,
      error: error.message || 'Erreur lors de la demande de permission arrière-plan',
    };
  }
}

/**
 * Vérifie si la permission est déjà accordée
 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Récupère la position actuelle de l'utilisateur
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  try {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      console.warn('[Location] Permission non accordée, utilisation de la position par défaut');
      return DEFAULT_LOCATION;
    }

    // 1) Try last known position first (instant, good UX) then fallback to live GPS.
    const last = await Location.getLastKnownPositionAsync();
    if (last?.coords?.latitude && last?.coords?.longitude) {
      return { lat: last.coords.latitude, lng: last.coords.longitude };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      // NOTE: expo-location ignores `timeInterval` for getCurrentPosition on some platforms,
      // but keeping it doesn't hurt and documents intent.
      timeInterval: 2000,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  } catch (error: any) {
    console.error('[Location] Erreur lors de la récupération de la position:', error);
    return DEFAULT_LOCATION;
  }
}

/**
 * Démarre le tracking GPS en temps réel
 * Retourne une fonction pour arrêter le tracking
 */
export async function watchLocation(
  onLocationUpdate: (coords: Coordinates) => void,
  onError?: (error: string) => void
): Promise<() => void> {
  try {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      onError?.('Permission de géolocalisation non accordée');
      return () => {};
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 10,
      },
      (location) => {
        onLocationUpdate({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    );

    // Retourne une fonction pour arrêter le tracking
    return () => {
      subscription.remove();
    };
  } catch (error: any) {
    console.error('[Location] Erreur lors du tracking:', error);
    onError?.(error.message || 'Erreur GPS');
    return () => {};
  }
}

/**
 * Calcule la distance entre deux coordonnées (formule Haversine)
 * Retourne la distance en mètres
 */
export function haversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Formate une distance en mètres pour l'affichage
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}


