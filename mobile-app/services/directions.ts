/**
 * Directions (Google Directions API)
 * Client-side call (no backend changes). Used for the in-app navigation screen.
 */

import axios from 'axios';
import type { Coordinates } from '../types/establishment';

export type TravelMode = 'driving' | 'walking' | 'bicycling';

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: Coordinates[]; // decoded overview polyline
  steps: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
};

function decodePolyline(encoded: string): Coordinates[] {
  // Google polyline decoding
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const points: Coordinates[] = [];

  while (index < len) {
    let b = 0;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchGoogleDirections(params: {
  origin: Coordinates;
  destination: Coordinates;
  mode: TravelMode;
  apiKey: string;
}): Promise<RouteResult> {
  if (!params.apiKey) throw new Error('GOOGLE_MAPS_API_KEY manquante (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)');

  const url = 'https://maps.googleapis.com/maps/api/directions/json';
  const res = await axios.get(url, {
    params: {
      origin: `${params.origin.lat},${params.origin.lng}`,
      destination: `${params.destination.lat},${params.destination.lng}`,
      mode: params.mode,
      key: params.apiKey,
    },
    timeout: 15000,
  });

  const data = res.data as any;
  const route = data?.routes?.[0];
  const leg = route?.legs?.[0];
  const poly = route?.overview_polyline?.points;
  if (!route || !leg || !poly) {
    const status = String(data?.status || 'UNKNOWN');
    const msg = String(data?.error_message || '');
    throw new Error(`Directions indisponibles (status=${status}) ${msg}`.trim());
  }

  const stepsRaw: any[] = Array.isArray(leg.steps) ? leg.steps : [];
  const steps = stepsRaw.map((s) => ({
    instruction: stripHtml(String(s?.html_instructions || '')),
    distanceMeters: Number(s?.distance?.value || 0),
    durationSeconds: Number(s?.duration?.value || 0),
  }));

  return {
    distanceMeters: Number(leg.distance?.value || 0),
    durationSeconds: Number(leg.duration?.value || 0),
    polyline: decodePolyline(String(poly)),
    steps,
  };
}


