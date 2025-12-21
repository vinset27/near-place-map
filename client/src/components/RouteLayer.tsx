import React, { useEffect, useState } from 'react';
import { Source, Layer } from 'react-map-gl';
import { getRoute, RouteInfo } from '@/lib/routing';

interface RouteLayerProps {
  userLat: number;
  userLng: number;
  destLat: number;
  destLng: number;
  onRouteUpdate?: (route: RouteInfo | null) => void;
}

export default function RouteLayer({
  userLat,
  userLng,
  destLat,
  destLng,
  onRouteUpdate,
}: RouteLayerProps) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRoute = async () => {
      setLoading(true);
      const routeData = await getRoute(userLng, userLat, destLng, destLat, 'driving');
      
      if (isMounted) {
        setRoute(routeData);
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
  }, [userLat, userLng, destLat, destLng, onRouteUpdate]);

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
    <Source id="route" type="geojson" data={geojsonData}>
      <Layer
        id="route-line"
        type="line"
        paint={{
          'line-color': '#ff6b35',
          'line-width': 5,
          'line-opacity': 0.8,
        }}
      />
    </Source>
  );
}
