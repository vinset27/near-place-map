const MAPBOX_TOKEN = 'pk.eyJ1IjoidHJvdXZlcmNoYXAiLCJhIjoiY21qZzk4ZHExMTE2cjNkc2R5YnhvYnRqYyJ9.kLaJ7Fd3pBs8NzF6vOTwcA';

export interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: Array<[number, number]>;
}

export async function getRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number,
  mode: 'driving' | 'walking' = 'driving'
): Promise<RouteInfo | null> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${startLng},${startLat};${endLng},${endLat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&steps=true&banner_instructions=true&language=fr`
    );

    if (!response.ok) {
      console.error('Mapbox Directions API error:', response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('No routes found');
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry.coordinates,
    };
  } catch (error) {
    console.error('Error fetching route:', error);
    return null;
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
