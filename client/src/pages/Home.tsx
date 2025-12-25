import React, { useMemo, useRef, useState, useEffect } from 'react';
import MapView from '@/components/Map';
import BottomNav from '@/components/BottomNav';
import FilterBar from '@/components/FilterBar';
import { establishments as staticEstablishments } from '@/lib/data';
import { haversineMeters, round4 } from '@/lib/geo';
import { getUpcomingEventsForEstablishments } from '@/lib/events';
import { fetchEstablishmentsNearby, toUiEstablishment } from '@/lib/establishmentsApi';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  // Default wider radius so Cocody/Angré shows up immediately for most users.
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25 | 50 | 200>(25);
  const [showEvents, setShowEvents] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  // Use a stabilized origin for DB fetches so tiny GPS jitter doesn't refetch every second on mobile.
  const [dbOrigin, setDbOrigin] = useState<{ lat: number; lng: number } | undefined>();
  const lastGpsRef = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const lastDbOriginRef = useRef<{ t: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const next = { lat: position.coords.latitude, lng: position.coords.longitude };
          const now = Date.now();
          const last = lastGpsRef.current;
          const acc = position.coords.accuracy;

          if (last) {
            const moved = haversineMeters({ lat: last.lat, lng: last.lng }, next);
            // Reduce jitter + excessive rerenders on mobile.
            // - If accuracy is poor (common on mobile), ignore small "moves".
            if (typeof acc === "number" && acc > 80 && moved < 35 && now - last.t < 8000) return;
            // - Normal throttle: don't update more than ~every 2s unless we really moved.
            if (now - last.t < 2000 && moved < 12) return;
          }

          lastGpsRef.current = { t: now, lat: next.lat, lng: next.lng };
          setUserLocation(next);
        },
        () => {
          // Default to Abidjan center if permission denied/unavailable
        setUserLocation({ lat: 5.3261, lng: -4.0200 });
        },
        {
          enableHighAccuracy: false,
          // Allow some caching to reduce noisy updates / battery drain.
          maximumAge: 15000,
          timeout: 10000,
        },
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, []);

  const origin = userLocation ?? { lat: 5.3261, lng: -4.0200 };
  const originForDb = dbOrigin ?? origin;
  const originForDbRounded = useMemo(
    () => ({ lat: round4(originForDb.lat), lng: round4(originForDb.lng) }),
    [originForDb.lat, originForDb.lng],
  );
  const originForUi = originForDbRounded;

  // Update DB origin only when the user moved enough or enough time passed.
  useEffect(() => {
    if (!userLocation) return;
    const now = Date.now();
    const last = lastDbOriginRef.current;
    if (last) {
      const moved = haversineMeters({ lat: last.lat, lng: last.lng }, userLocation);
      // If stationary, don't refetch the whole DB list due to tiny GPS jitter.
      if (moved < 35 && now - last.t < 8000) return;
    }
    const next = { lat: round4(userLocation.lat), lng: round4(userLocation.lng) };
    setDbOrigin(next);
    lastDbOriginRef.current = { t: now, lat: next.lat, lng: next.lng };
  }, [userLocation]);

  const radiusMeters = radiusKm * 1000;
  const q = query.trim().toLowerCase();

  const filteredStatic = staticEstablishments
    .filter((e) => {
      if (activeFilter !== 'all' && e.category !== activeFilter) return false;
      if (q) {
        const hay = `${e.name} ${e.address} ${e.commune} ${e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return haversineMeters(originForUi, e.coordinates) <= radiusMeters;
    })
    .sort(
      (a, b) =>
        haversineMeters(originForUi, a.coordinates) - haversineMeters(originForUi, b.coordinates),
    );

  const { data: dbNearby, error: dbError } = useQuery({
    queryKey: ['db-establishments', originForDbRounded.lat, originForDbRounded.lng, radiusKm, activeFilter, q],
    enabled: Number.isFinite(originForDbRounded.lat) && Number.isFinite(originForDbRounded.lng),
    queryFn: async () =>
      fetchEstablishmentsNearby({
        lat: originForDbRounded.lat,
        lng: originForDbRounded.lng,
        radiusKm,
        limit: radiusKm >= 200 ? 5000 : radiusKm >= 50 ? 3500 : radiusKm >= 25 ? 2200 : 1200,
        category: activeFilter,
        q: query.trim(),
      }),
    // Keep results for a while; avoid refetching just because user navigated between pages.
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const merged = useMemo(() => {
    const db = (dbNearby || []).map(toUiEstablishment);
    // Merge and dedupe by id.
    const seen = new Set<string>();
    const out = [];
    for (const e of [...db, ...filteredStatic]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      // Ensure distance is available everywhere (list/map/details).
      const d = haversineMeters(originForUi, e.coordinates);
      out.push({ ...e, distanceMeters: d });
    }
    return out;
  }, [dbNearby, filteredStatic, originForUi.lat, originForUi.lng]);

  const events = showEvents ? getUpcomingEventsForEstablishments(merged) : [];

  return (
    <div className="h-screen w-full relative bg-background overflow-hidden flex flex-col">
      <div className="flex-1 relative z-0">
        <MapView 
          userLocation={userLocation}
          establishmentsData={merged}
          events={events}
          highlightedId={highlightedId}
        />
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          query={query}
          onQueryChange={setQuery}
          radiusKm={radiusKm}
          onRadiusKmChange={setRadiusKm}
          showEvents={showEvents}
          onShowEventsChange={setShowEvents}
          suggestions={merged}
          onSuggestionSelect={(id) => {
            setActiveFilter('all');
            setHighlightedId(id);
          }}
        />

        {dbError && (
          <div className="absolute left-0 right-0 bottom-44 px-4 z-10 pointer-events-none">
            <div className="mx-auto max-w-md rounded-2xl bg-amber-50/90 backdrop-blur-xl border border-amber-200 p-4 text-center">
              <div className="text-sm font-semibold text-amber-900">Chargement des lieux (DB) impossible</div>
              <div className="mt-1 text-xs text-amber-900/80 break-words">
                {String((dbError as any)?.message || dbError)}
              </div>
              <div className="mt-2 text-xs text-amber-900/70">
                Si ton front est sur un autre domaine que l’API: vérifie <code>VITE_API_BASE_URL</code> (au build) et{" "}
                <code>CORS_ORIGINS</code> (côté backend).
              </div>
            </div>
          </div>
        )}

        {merged.length === 0 && (
          <div className="absolute left-0 right-0 bottom-24 px-4 z-10 pointer-events-none">
            <div className="mx-auto max-w-md rounded-2xl bg-background/85 backdrop-blur-xl border border-border p-4 text-center">
              <div className="text-sm font-semibold text-foreground">Aucun établissement ici pour le moment.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Revenez plus tard ou explorez ailleurs.
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
