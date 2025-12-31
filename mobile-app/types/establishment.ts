/**
 * Types d'établissements - STRICTEMENT identiques au projet web
 * Ne pas modifier ces types - ils correspondent aux réponses API backend
 */

export type EstablishmentCategory =
  | 'cave'
  | 'maquis'
  | 'bar'
  | 'lounge'
  | 'restaurant'
  | 'hotel'
  | 'pharmacy'
  | 'police'
  | 'hospital'
  | 'emergency'
  | 'organizer'
  | 'other';

export interface Coordinates {
  lat: number;
  lng: number;
}

// Type retourné par l'API backend (ne pas modifier)
export interface ApiEstablishment {
  id: string;
  name: string;
  category: string;
  address: string | null;
  commune: string | null;
  phone: string | null;
  description: string | null;
  photos?: string[] | null;
  // Optional provider fields (present in DB for Google imports / manual)
  provider?: string | null;
  providerPlaceId?: string | null;
  published?: boolean;
  lat: number;
  lng: number;
  distanceMeters?: number;
}

// Type utilisé dans l'UI de l'app (converti depuis ApiEstablishment)
export interface Establishment {
  id: string;
  name: string;
  category: EstablishmentCategory;
  description: string;
  address: string;
  commune: string;
  phone: string | null;
  coordinates: Coordinates;
  distanceMeters?: number;
  rating: number;
  // Backend doesn't provide open status; this can be enriched via Google Place Details when available.
  isOpen: boolean;
  imageUrl: string;
  photos?: string[];
  features: string[];
  provider?: string | null;
  providerPlaceId?: string | null;
}

export const ESTABLISHMENT_CATEGORIES: Array<{
  id: EstablishmentCategory;
  label: string;
  color: string;
}> = [
  { id: 'maquis', label: 'Maquis', color: '#f97316' },
  { id: 'lounge', label: 'Lounge', color: '#a855f7' },
  { id: 'bar', label: 'Bar', color: '#3b82f6' },
  { id: 'cave', label: 'Cave', color: '#10b981' },
  { id: 'restaurant', label: 'Restaurant', color: '#fb7185' },
  { id: 'hotel', label: 'Hôtel', color: '#64748b' },
  { id: 'pharmacy', label: 'Pharmacie', color: '#06b6d4' },
  { id: 'police', label: 'Police', color: '#f59e0b' },
  { id: 'hospital', label: 'Hôpital', color: '#ef4444' },
  { id: 'emergency', label: 'Secours', color: '#dc2626' },
  { id: 'organizer', label: 'Organisateur', color: '#6366f1' },
  { id: 'other', label: 'Autre', color: '#94a3b8' },
];


