/**
 * Mapbox Directions (same as web routing.ts)
 * Used for in-app navigation polyline + steps, without changing backend.
 */

import Constants from 'expo-constants';
import type { Coordinates } from '../types/establishment';

export type RouteStep = {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  name?: string;
  maneuver: {
    location: [number, number]; // [lng, lat]
    type: string;
    modifier?: string;
    bearingBefore?: number;
    bearingAfter?: number;
  };
};

export type RouteInfo = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: Coordinates[]; // lat/lng points
  steps: RouteStep[];
};

type TravelMode = 'driving' | 'walking' | 'cycling';

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function routeKey(a: Coordinates, b: Coordinates, mode: TravelMode) {
  return `${mode}:${round4(a.lng)},${round4(a.lat)}->${round4(b.lng)},${round4(b.lat)}`;
}

type CachedRoute = { at: number; value: RouteInfo | null };
const ROUTE_TTL_MS = 3 * 60_000;
const routeCache = new Map<string, CachedRoute>();
const inflight = new Map<string, Promise<RouteInfo | null>>();

function getMapboxToken(): string {
  const fromEnv = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  const fromExtra = (Constants.expoConfig as any)?.extra?.mapbox?.token;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return '';
}

export async function fetchMapboxRoute(params: {
  origin: Coordinates;
  destination: Coordinates;
  mode: TravelMode;
}): Promise<RouteInfo | null> {
  const token = getMapboxToken();
  if (!token) throw new Error('MAPBOX token manquant (VITE_MAPBOX_TOKEN / EXPO_PUBLIC_MAPBOX_TOKEN)');

  const key = routeKey(params.origin, params.destination, params.mode);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.at < ROUTE_TTL_MS) return cached.value;
  const inF = inflight.get(key);
  if (inF) return await inF;

  const p = (async () => {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${params.mode}/` +
      `${params.origin.lng},${params.origin.lat};${params.destination.lng},${params.destination.lat}` +
      `?access_token=${encodeURIComponent(token)}&geometries=geojson&steps=true&banner_instructions=true&language=fr`;

    const res = await fetch(url);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Mapbox error ${res.status}: ${bodyText.slice(0, 180) || 'request failed'}`);
    }
    const data = (await res.json()) as any;
    if (data?.code && data.code !== 'Ok') {
      throw new Error(`Mapbox: ${String(data.code)} ${String(data.message || '')}`.trim());
    }
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error('Mapbox: no route geometry');
    }

    const coords: Coordinates[] = route.geometry.coordinates.map((c: [number, number]) => ({
      lng: c[0],
      lat: c[1],
    }));

    const steps: RouteStep[] =
      route.legs?.[0]?.steps?.map((s: any) => ({
        distanceMeters: Number(s.distance || 0),
        durationSeconds: Number(s.duration || 0),
        instruction: String(s?.maneuver?.instruction || ''),
        name: s?.name ? String(s.name) : undefined,
        maneuver: {
          location: s?.maneuver?.location,
          type: String(s?.maneuver?.type || ''),
          modifier: s?.maneuver?.modifier ? String(s.maneuver.modifier) : undefined,
          bearingBefore: typeof s?.maneuver?.bearing_before === 'number' ? s.maneuver.bearing_before : undefined,
          bearingAfter: typeof s?.maneuver?.bearing_after === 'number' ? s.maneuver.bearing_after : undefined,
        },
      })) ?? [];

    return {
      distanceMeters: Number(route.distance || 0),
      durationSeconds: Number(route.duration || 0),
      geometry: coords,
      steps,
    } satisfies RouteInfo;
  })();

  inflight.set(key, p);
  const value = await p;
  inflight.delete(key);
  routeCache.set(key, { at: Date.now(), value });
  if (routeCache.size > 200) {
    const first = routeCache.keys().next().value;
    if (first) routeCache.delete(first);
  }
  return value;
}


