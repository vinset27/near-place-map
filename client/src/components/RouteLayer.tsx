import React, { useEffect, useRef, useState } from 'react';
import { Source, Layer } from 'react-map-gl';
import { getRoute, RouteInfo } from '@/lib/routing';
import { haversineMeters } from '@/lib/geo';

interface RouteLayerProps {
  userLat: number;
  userLng: number;
  destLat: number;
  destLng: number;
  mode?: 'driving' | 'walking';
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
    for (let i = 0; i < coords.length - 1; i += 2) {
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
        const offRouteThreshold = mode === 'walking' ? 20 : 35;
        const rerouteCooldownMs = mode === 'walking' ? 6000 : 8000;
        const shouldRerouteForDeviation =
          offRoute > offRouteThreshold && now - lastFetchAtRef.current > rerouteCooldownMs;

        const movedThreshold = mode === 'walking' ? 80 : 200;

        if (!destChanged && !shouldRerouteForDeviation && moved < movedThreshold) {
          // No reroute needed; don't set state on every GPS tick.
          return;
        }
      }

      setLoading(true);
      const routeData = await getRoute(userLng, userLat, destLng, destLat, mode);
      
      if (isMounted) {
        setRoute(routeData);
        lastFetchRef.current = { start, dest };
        lastFetchAtRef.current = Date.now();
        if (onRouteUpdate) {
          onRouteUpdate(routeData);
        }
        setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [userLat, userLng, destLat, destLng, mode, onRouteUpdate]);

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
