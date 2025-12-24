import React, { useEffect, useMemo, useState } from 'react';
import EstablishmentCard from '@/components/EstablishmentCard';
import BottomNav from '@/components/BottomNav';
import { establishments as staticEstablishments } from '@/lib/data';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchEstablishmentsNearby, toUiEstablishment } from '@/lib/establishmentsApi';
import { haversineMeters } from '@/lib/geo';

export default function List() {
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25>(10);
  const [category, setCategory] = useState('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setUserLocation({ lat: 5.3261, lng: -4.02 }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const origin = userLocation ?? { lat: 5.3261, lng: -4.02 };
  const q = query.trim().toLowerCase();

  const { data: dbNearby } = useQuery({
    queryKey: ['list-establishments', origin.lat, origin.lng, radiusKm, category, q],
    queryFn: async () =>
      fetchEstablishmentsNearby({
        lat: origin.lat,
        lng: origin.lng,
        radiusKm,
        limit: 500,
        category,
        q: query.trim(),
      }),
    staleTime: 1000 * 20,
  });

  const merged = useMemo(() => {
    const db = (dbNearby || []).map(toUiEstablishment);
    const seen = new Set<string>();
    const out = [];
    for (const e of [...db, ...staticEstablishments]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out
      .filter((e) => {
        if (category !== 'all' && e.category !== category) return false;
        if (q) {
          const hay = `${e.name} ${e.address} ${e.commune} ${e.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          haversineMeters(origin, a.coordinates) - haversineMeters(origin, b.coordinates),
      );
  }, [dbNearby, staticEstablishments, origin, radiusKm, category, q, query]);

  const categories = [
    { id: 'all', label: 'Tous' },
    { id: 'maquis', label: 'Maquis' },
    { id: 'bar', label: 'Bars' },
    { id: 'lounge', label: 'Lounges' },
    { id: 'cave', label: 'Caves' },
    { id: 'restaurant', label: 'Restaurants' },
    { id: 'hotel', label: 'Hôtels' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4">
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">À proximité</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Filtrer la liste..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-secondary/50 border-none rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                  category === c.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/60 border-border text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[5, 10, 25].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r as 5 | 10 | 25)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  radiusKm === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/60 border-border text-foreground'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {merged.map((est) => (
          <EstablishmentCard key={est.id} establishment={est} />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
