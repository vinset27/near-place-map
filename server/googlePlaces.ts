type NearbySearchResponse = {
  results?: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    types?: string[];
    geometry?: { location?: { lat: number; lng: number } };
  }>;
  next_page_token?: string;
  status?: string;
  error_message?: string;
};

export function mapGoogleTypesToCategory(types: string[] | undefined): string {
  const t = new Set((types || []).map((x) => x.toLowerCase()));
  if (t.has("lodging")) return "hotel";
  if (t.has("liquor_store")) return "cave";
  if (t.has("pharmacy") || t.has("drugstore")) return "pharmacy";
  if (t.has("police") || t.has("police_station")) return "police";
  if (t.has("hospital") || t.has("doctor") || t.has("health")) return "hospital";
  if (t.has("fire_station") || t.has("ambulance")) return "emergency";
  if (t.has("event_venue")) return "organizer";
  if (t.has("restaurant") || t.has("meal_takeaway") || t.has("meal_delivery")) return "restaurant";
  if (t.has("night_club")) return "lounge";
  if (t.has("bar") || t.has("cafe")) return "bar";
  return "other";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function googlePlacesNearby(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  // Google Places legacy "type" (single); we call multiple times for multiple types.
  type: string;
}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not configured");

  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${params.lat},${params.lng}`);
  url.searchParams.set("radius", String(params.radiusMeters));
  url.searchParams.set("type", params.type);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as NearbySearchResponse;
  if (!res.ok || (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS")) {
    throw new Error(data.error_message || `Google Places error: ${data.status || res.status}`);
  }
  return data;
}

export async function googlePlacesNearbyAll(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  type: string;
}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not configured");

  const all: NearbySearchResponse["results"] = [];

  // page 1
  const first = await googlePlacesNearby(params);
  all.push(...(first.results || []));

  // pages 2-3 (token may take ~2s to activate)
  let token = first.next_page_token;
  for (let i = 0; i < 2 && token; i++) {
    await sleep(2100);
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("pagetoken", token);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    const data = (await res.json()) as NearbySearchResponse;
    if (!res.ok || (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS")) {
      // If token isn't ready, don't hard fail the whole import; stop here.
      break;
    }
    all.push(...(data.results || []));
    token = data.next_page_token;
  }

  return all;
}


