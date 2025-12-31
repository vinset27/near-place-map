/**
 * Service d'accès aux établissements
 * ⚠️ RESPECTE STRICTEMENT LES ROUTES API BACKEND EXISTANTES
 */

import api from './api';
import { ApiEstablishment, Establishment, EstablishmentCategory } from '../types/establishment';

/**
 * Convertit un établissement API en établissement UI
 * (Logique identique au projet web)
 */
export function toUiEstablishment(e: ApiEstablishment): Establishment {
  const category = (e.category || 'restaurant') as EstablishmentCategory;
  const photos =
    Array.isArray(e.photos)
      ? e.photos.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : undefined;
  const photo0 = photos && photos.length > 0 ? photos[0] : null;

  const provider = (e as any).provider ?? (e as any).provider_name ?? null;
  const providerPlaceId =
    (e as any).providerPlaceId ??
    (e as any).provider_place_id ??
    (e as any).providerPlaceID ??
    null;

  return {
    id: e.id,
    name: e.name,
    category,
    description: e.description || 'Nouveau lieu ajouté sur la carte.',
    address: e.address || '',
    commune: e.commune || '',
    phone: e.phone ?? null,
    coordinates: { lat: e.lat, lng: e.lng },
    distanceMeters: typeof e.distanceMeters === 'number' ? e.distanceMeters : undefined,
    rating: 4.5,
    isOpen: true,
    // Use real photo if provided; otherwise leave empty and rely on local fallbacks in UI.
    imageUrl: photo0 || '',
    features: [],
    photos,
    provider,
    providerPlaceId,
  };
}

/**
 * Récupère les établissements à proximité
 * Route API: GET /api/establishments?lat={lat}&lng={lng}&radiusKm={radius}&category={cat}&q={query}&limit={limit}
 */
export interface FetchNearbyParams {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  q?: string;
  limit?: number;
}

export async function fetchEstablishmentsNearby(
  params: FetchNearbyParams
): Promise<ApiEstablishment[]> {
  // Validation des paramètres requis
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error(
      `fetchEstablishmentsNearby: lat/lng must be finite numbers (got lat=${String(
        params.lat
      )}, lng=${String(params.lng)})`
    );
  }

  const queryParams: Record<string, string> = {
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm),
  };

  // Limite par défaut basée sur le rayon
  const limit =
    typeof params.limit === 'number'
      ? params.limit
      : params.radiusKm >= 25
      ? 2000
      : 1200;
  queryParams.limit = String(Math.min(5000, Math.max(1, Math.floor(limit))));

  if (params.category && params.category !== 'all') {
    queryParams.category = params.category;
  }
  if (params.q) {
    queryParams.q = params.q;
  }

  const response = await api.get<{ establishments?: ApiEstablishment[] }>(
    '/api/establishments',
    { params: queryParams }
  );

  return (response.data?.establishments || []) as ApiEstablishment[];
}

/**
 * Récupère un établissement par son ID
 * Route API: GET /api/establishments/:id
 */
export async function fetchEstablishmentById(
  id: string
): Promise<ApiEstablishment | null> {
  try {
    const response = await api.get<{ establishment?: ApiEstablishment | null }>(
      `/api/establishments/${encodeURIComponent(id)}`
    );
    return (response.data?.establishment || null) as ApiEstablishment | null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Crée un nouvel établissement (nécessite authentification)
 * Route API: POST /api/establishments
 */
export interface CreateEstablishmentInput {
  name: string;
  category: string;
  phone?: string;
  address?: string;
  commune?: string;
  description?: string;
  photos?: string[];
  lat: number;
  lng: number;
}

export async function createEstablishment(
  input: CreateEstablishmentInput
): Promise<ApiEstablishment> {
  const response = await api.post<ApiEstablishment>('/api/establishments', input, {
    withCredentials: true,
  });
  return response.data;
}

/**
 * Public flow (like web): submit a business application.
 * Backend: POST /api/business/apply (creates a pending request to be approved by admin)
 */
export async function submitBusinessApplication(input: {
  name: string;
  category: string;
  phone: string;
  description?: string;
  photos?: string[];
  address?: string;
  commune?: string;
  lat: number;
  lng: number;
}): Promise<{ id: string; status: string; createdAt: string }> {
  const res = await api.post('/api/business/apply', input);
  return res.data as any;
}


