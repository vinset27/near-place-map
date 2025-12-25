import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { debugLog } from "@/lib/debug";

export interface RouteStep {
  distance: number; // meters
  duration: number; // seconds
  instruction: string;
  name?: string;
  maneuver: {
    location: [number, number]; // [lng, lat]
    type: string;
    modifier?: string;
    bearing_before?: number;
    bearing_after?: number;
  };
}

export interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: Array<[number, number]>;
  steps: RouteStep[];
}

type CachedRoute = { at: number; value: RouteInfo | null };
// Keep routes cached longer so Navigation doesn't immediately recompute after Details.
const ROUTE_TTL_MS = 3 * 60_000;
const routeCache = new Map<string, CachedRoute>();
const inflight = new Map<string, Promise<RouteInfo | null>>();

function round4(n: number) {
  // ~11m at equator; good tradeoff to dedupe GPS jitter & repeated reroute checks.
  return Math.round(n * 1e4) / 1e4;
}

function routeKey(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  mode: "driving" | "walking" | "cycling",
) {
  // Round coordinates to dedupe noisy GPS updates while still being accurate enough for navigation.
  return `${mode}:${round4(startLng)},${round4(startLat)}->${round4(endLng)},${round4(endLat)}`;
}

export async function getRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  mode: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<RouteInfo | null> {
  try {
    const key = routeKey(startLng, startLat, endLng, endLat, mode);
    const cached = routeCache.get(key);
    if (cached && Date.now() - cached.at < ROUTE_TTL_MS) return cached.value;
    const inF = inflight.get(key);
    if (inF) return await inF;

    const p = (async () => {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?access_token=${MAPBOX_TOKEN}&geometries=geojson&steps=true&banner_instructions=true&language=fr`;
    debugLog("getRoute request", { key, url });
    const response = await fetch(url);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      debugLog("getRoute error", { key, status: response.status, bodyHead: bodyText.slice(0, 300) });
      console.error('Mapbox Directions API error:', response.status, bodyText.slice(0, 500));
      return null as RouteInfo | null;
    }

    const data = await response.json();
    debugLog("getRoute response", { key, code: data?.code || null, routes: data?.routes?.length ?? 0 });

    if (data?.code && data.code !== "Ok") {
      console.error("Mapbox Directions API non-Ok:", data.code, data.message || "");
      return null as RouteInfo | null;
    }

    if (!data.routes || data.routes.length === 0) {
      console.error('No routes found', data?.code || "");
      return null as RouteInfo | null;
    }

    const route = data.routes[0];
    const steps: RouteStep[] =
      route.legs?.[0]?.steps?.map((s: any) => ({
        distance: s.distance,
        duration: s.duration,
        instruction: s.maneuver?.instruction ?? '',
        name: s.name,
        maneuver: {
          location: s.maneuver?.location,
          type: s.maneuver?.type,
          modifier: s.maneuver?.modifier,
          bearing_before: s.maneuver?.bearing_before,
          bearing_after: s.maneuver?.bearing_after,
        },
      })) ?? [];

    const out: RouteInfo = {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry.coordinates,
      steps,
    };
    return out;
    })();

    inflight.set(key, p);
    const value = await p;
    inflight.delete(key);
    routeCache.set(key, { at: Date.now(), value });
    // basic bound to avoid unbounded growth
    if (routeCache.size > 200) {
      const first = routeCache.keys().next().value;
      if (first) routeCache.delete(first);
    }
    return value;
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
  } finally {
    // no-op
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
