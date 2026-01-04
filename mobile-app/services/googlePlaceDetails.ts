import Constants from 'expo-constants';

export type GooglePlaceDetails = {
  photoUrls: string[];
  openNow?: boolean;
};

function getPlacesApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  const fromExtra = (Constants.expoConfig as any)?.extra?.google?.mapsApiKey;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return '';
}

function buildPhotoUrl(photoReference: string, opts?: { maxWidth?: number }) {
  const key = getPlacesApiKey();
  const maxWidth = opts?.maxWidth ?? 1200;
  const url = new URL('https://maps.googleapis.com/maps/api/place/photo');
  url.searchParams.set('maxwidth', String(maxWidth));
  url.searchParams.set('photo_reference', photoReference);
  url.searchParams.set('key', key);
  return url.toString();
}

export async function fetchGooglePlaceDetails(params: {
  placeId: string;
}): Promise<GooglePlaceDetails> {
  const key = getPlacesApiKey();
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY manquante (env)');

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', params.placeId);
  url.searchParams.set('fields', 'photos,opening_hours');
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as any;
  if (!res.ok || data?.status !== 'OK') {
    throw new Error(data?.error_message || `Google Places details error: ${data?.status || res.status}`);
  }

  const photos = Array.isArray(data?.result?.photos) ? data.result.photos : [];
  const photoUrls = photos
    .map((p: any) => String(p?.photo_reference || ''))
    .filter(Boolean)
    .slice(0, 10)
    .map((ref: string) => buildPhotoUrl(ref, { maxWidth: 1200 }));

  const openNow = data?.result?.opening_hours?.open_now;
  return {
    photoUrls,
    openNow: typeof openNow === 'boolean' ? openNow : undefined,
  };
}













