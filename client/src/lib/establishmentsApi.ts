import type { Establishment } from "@/lib/data";
import { placeholderImageDataUrl } from "@/lib/placeImages";
import { apiUrl } from "@/lib/apiBase";

export type ApiEstablishment = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  commune: string | null;
  phone: string | null;
  description: string | null;
  photos?: string[] | null;
  lat: number;
  lng: number;
  distanceMeters?: number;
};

export function toUiEstablishment(e: ApiEstablishment): Establishment {
  const category = (e.category || "restaurant") as Establishment["category"];
  const photo0 =
    Array.isArray(e.photos) && e.photos.length > 0 && typeof e.photos[0] === "string" ? e.photos[0] : null;
  return {
    id: e.id,
    name: e.name,
    category,
    description: e.description || "Nouveau lieu ajouté sur la carte.",
    address: e.address || "",
    commune: (e.commune || "Plateau") as any,
    phone: e.phone ?? null,
    coordinates: { lat: e.lat, lng: e.lng },
    rating: 4.5,
    isOpen: true,
    // Always prioritize uploaded photos (R2/DB). If missing, use a unique deterministic placeholder.
    imageUrl: photo0 || placeholderImageDataUrl({ id: e.id, name: e.name, category }),
    features: [],
    photos: Array.isArray(e.photos) ? e.photos : undefined,
  };
}

export async function fetchEstablishmentsNearby(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  category?: string;
  q?: string;
  limit?: number;
}): Promise<ApiEstablishment[]> {
  // Guard against accidentally sending "undefined"/NaN to the API (would produce 400: lat/lng are required).
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    throw new Error(
      `fetchEstablishmentsNearby: lat/lng must be finite numbers (got lat=${String(params.lat)}, lng=${String(
        params.lng,
      )})`,
    );
  }
  const sp = new URLSearchParams();
  sp.set("lat", String(params.lat));
  sp.set("lng", String(params.lng));
  sp.set("radiusKm", String(params.radiusKm));
  // Default higher so "some zones" don't disappear when we have lots of imported places.
  // Keep it bounded; rendering is handled with clustering on the map.
  const limit = typeof params.limit === "number" ? params.limit : (params.radiusKm >= 25 ? 2000 : 1200);
  sp.set("limit", String(Math.min(5000, Math.max(1, Math.floor(limit)))));
  if (params.category) sp.set("category", params.category);
  if (params.q) sp.set("q", params.q);

  // Public endpoint: do not send cookies/credentials (simplifies CORS for split-origin deployments).
  const res = await fetch(apiUrl(`/api/establishments?${sp.toString()}`));
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data?.establishments || []) as ApiEstablishment[];
}

export async function fetchEstablishmentById(id: string): Promise<ApiEstablishment | null> {
  // Public endpoint: do not send cookies/credentials (simplifies CORS for split-origin deployments).
  const res = await fetch(apiUrl(`/api/establishments/${encodeURIComponent(id)}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data?.establishment || null) as ApiEstablishment | null;
}

export async function createEstablishment(input: {
  name: string;
  category: string;
  phone?: string;
  address?: string;
  commune?: string;
  description?: string;
  photos?: string[];
  lat: number;
  lng: number;
}) {
  const res = await fetch(apiUrl("/api/establishments"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}


