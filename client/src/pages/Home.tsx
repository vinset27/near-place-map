import React, { useMemo, useState, useEffect } from 'react';
import MapView from '@/components/Map';
import BottomNav from '@/components/BottomNav';
import FilterBar from '@/components/FilterBar';
import { establishments as staticEstablishments } from '@/lib/data';
import { haversineMeters } from '@/lib/geo';
import { getUpcomingEventsForEstablishments } from '@/lib/events';
import { fetchEstablishmentsNearby, toUiEstablishment } from '@/lib/establishmentsApi';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined);
  // Default wider radius so Cocody/Angré shows up immediately for most users.
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25>(25);
  const [showEvents, setShowEvents] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        },
        () => {
          // Default to Abidjan center if permission denied/unavailable
        setUserLocation({ lat: 5.3261, lng: -4.0200 });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        },
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, []);

  const origin = userLocation ?? { lat: 5.3261, lng: -4.0200 };
  const radiusMeters = radiusKm * 1000;
  const q = query.trim().toLowerCase();

  const filteredStatic = staticEstablishments
    .filter((e) => {
      if (activeFilter !== 'all' && e.category !== activeFilter) return false;
      if (q) {
        const hay = `${e.name} ${e.address} ${e.commune} ${e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return haversineMeters(origin, e.coordinates) <= radiusMeters;
    })
    .sort(
      (a, b) =>
        haversineMeters(origin, a.coordinates) - haversineMeters(origin, b.coordinates),
    );

  const { data: dbNearby } = useQuery({
    queryKey: ['db-establishments', origin.lat, origin.lng, radiusKm, activeFilter, q],
    enabled: Boolean(origin?.lat && origin?.lng),
    queryFn: async () =>
      fetchEstablishmentsNearby({
        lat: origin.lat,
        lng: origin.lng,
        radiusKm,
        limit: radiusKm >= 25 ? 2000 : 1200,
        category: activeFilter,
        q: query.trim(),
      }),
    staleTime: 1000 * 30,
  });

  const merged = useMemo(() => {
    const db = (dbNearby || []).map(toUiEstablishment);
    // Merge and dedupe by id.
    const seen = new Set<string>();
    const out = [];
    for (const e of [...db, ...filteredStatic]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }, [dbNearby, filteredStatic]);

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
