import React, { useEffect, useRef, useState } from 'react';
import { Source, Layer } from 'react-map-gl';
import { getRoute, RouteInfo } from '@/lib/routing';
import { haversineMeters } from '@/lib/geo';

interface RouteLayerProps {
  userLat: number;
  userLng: number;
  destLat: number;
  destLng: number;
  mode?: 'driving' | 'walking' | 'cycling';
  onRouteUpdate?: (route: RouteInfo | null) => void;
}

export default function RouteLayer({
  userLat,
  userLng,
  destLat,
  destLng,
  mode = 'driving',
  onRouteUpdate,
}: RouteLayerProps) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<{
    start: { lat: number; lng: number };
    dest: { lat: number; lng: number };
  } | null>(null);
  const lastFetchAtRef = useRef<number>(0);

  const distanceToRouteMeters = (p: { lat: number; lng: number }, coords: Array<[number, number]>) => {
    if (coords.length < 2) return Infinity;
    let best = Infinity;
    // Adaptive stride: accurate for short routes, cheaper for long ones.
    const stride = coords.length > 600 ? 3 : 1;
    for (let i = 0; i < coords.length - 1; i += stride) {
      const a = coords[i];
      const b = coords[i + 1];
      const d = pointToSegmentMeters(p, a, b);
      if (d < best) best = d;
    }
    return best;
  };

  useEffect(() => {
    let isMounted = true;

    const fetchRoute = async () => {
      const start = { lat: userLat, lng: userLng };
      const dest = { lat: destLat, lng: destLng };

      // If we're basically at the destination, keep the last known route (don't clear it).
      // This prevents the line from disappearing right at the end due to GPS jitter.
      if (haversineMeters(start, dest) < 25) {
        if (isMounted) setLoading(false);
        return;
      }

      // Avoid hammering the Directions API on every GPS tick.
      // Recalculate only if the user moved significantly, or destination changed.
      const last = lastFetchRef.current;
      if (last) {
        const moved = haversineMeters(last.start, start);
        const destChanged = haversineMeters(last.dest, dest) > 5;
        const now = Date.now();

        // If user is clearly off-route, reroute sooner (Glovo-like).
        const offRoute =
          route && route.geometry && route.geometry.length > 1
            ? distanceToRouteMeters(start, route.geometry)
            : 0;
        const offRouteThreshold = mode === 'walking' ? 18 : mode === 'cycling' ? 22 : 28;
        const rerouteCooldownMs = mode === 'walking' ? 4500 : mode === 'cycling' ? 5200 : 6000;
        const shouldRerouteForDeviation =
          offRoute > offRouteThreshold && now - lastFetchAtRef.current > rerouteCooldownMs;

        // Refresh more frequently so the route stays "best" while moving (Glovo-like),
        // without hammering the API.
        const movedThreshold = mode === 'walking' ? 45 : mode === 'cycling' ? 80 : 120;
        const minRefreshMs = mode === 'walking' ? 2500 : mode === 'cycling' ? 3000 : 3500;

        if (!destChanged && !shouldRerouteForDeviation && moved < movedThreshold) {
          // No reroute needed; don't set state on every GPS tick.
          return;
        }
        if (!destChanged && !shouldRerouteForDeviation && now - lastFetchAtRef.current < minRefreshMs) return;
      }

      setLoading(true);
      const routeData = await getRoute(userLng, userLat, destLng, destLat, mode);
      
      if (isMounted) {
        // Sticky behavior: do NOT clear an existing route on transient failures.
        // Keep last good polyline until we successfully fetch a new one.
        if (routeData) {
          setRoute(routeData);
        } else if (!route) {
          setRoute(null);
        }
        lastFetchRef.current = { start, dest };
        lastFetchAtRef.current = Date.now();
        if (onRouteUpdate) {
          // Same sticky behavior for parent UI (distance/duration):
          // only report null if we don't have any route at all.
          onRouteUpdate(routeData ?? route ?? null);
        }
        setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [userLat, userLng, destLat, destLng, mode, onRouteUpdate, route]);

  if (!route) {
    return null;
  }

  const geojsonData = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: route.geometry,
    },
    properties: {},
  };

  return (
    <Source id="route" type="geojson" data={geojsonData} lineMetrics>
      <Layer
        id="route-line-glow"
        type="line"
        paint={{
          'line-color': '#ff6b35',
          'line-width': 12,
          'line-opacity': 0.18,
          'line-blur': 2,
        }}
      />
      <Layer
        id="route-line-casing"
        type="line"
        paint={{
          'line-color': '#0b1220',
          'line-width': 7,
          'line-opacity': 0.25,
        }}
      />
      <Layer
        id="route-line"
        type="line"
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          // Gradient makes it feel "live" and easier to read.
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            '#22c55e',
            0.35,
            '#60a5fa',
            0.7,
            '#ff6b35',
            1,
            '#ff2d55',
          ],
          'line-width': 5,
          'line-opacity': 0.95,
        }}
      />
    </Source>
  );
}

function pointToSegmentMeters(p: { lat: number; lng: number }, a: [number, number], b: [number, number]) {
  const lat0 = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const mx = (lng: number) => (lng * Math.PI / 180) * Math.cos(lat0) * 6371000;
  const my = (lat: number) => (lat * Math.PI / 180) * 6371000;

  const ax = mx(a[0]), ay = my(a[1]);
  const bx = mx(b[0]), by = my(b[1]);
  const px = mx(p.lng), py = my(p.lat);

  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  const tt = Math.max(0, Math.min(1, t));
  const cx = ax + abx * tt;
  const cy = ay + aby * tt;
  const dx = px - cx, dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}
