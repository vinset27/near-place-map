import React, { useEffect, useMemo, useRef, useState } from 'react';
import EstablishmentCard from '@/components/EstablishmentCard';
import BottomNav from '@/components/BottomNav';
import { establishments as staticEstablishments } from '@/lib/data';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchEstablishmentsNearby, toUiEstablishment } from '@/lib/establishmentsApi';
import { haversineMeters, round4 } from '@/lib/geo';
import { ESTABLISHMENT_CATEGORIES } from '@/lib/categories';
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command';
import { rankEstablishmentSuggestions } from '@/lib/suggestions';
import { useLocation } from 'wouter';

export default function List() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25 | 50 | 200>(10);
  const [category, setCategory] = useState('all');
  // Only update origin occasionally (avoids list "refreshing" every second on mobile GPS jitter).
  const [dbOrigin, setDbOrigin] = useState<{ lat: number; lng: number }>({ lat: 5.3261, lng: -4.02 });
  const lastDbOriginRef = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const [openSuggest, setOpenSuggest] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextRaw = { lat: position.coords.latitude, lng: position.coords.longitude };
        const next = { lat: round4(nextRaw.lat), lng: round4(nextRaw.lng) };
        const now = Date.now();
        const last = lastDbOriginRef.current;
        if (last) {
          const moved = haversineMeters({ lat: last.lat, lng: last.lng }, next);
          // If stationary, don't refetch/re-render due to tiny GPS jitter.
          if (moved < 35 && now - last.t < 8000) return;
        }
        lastDbOriginRef.current = { t: now, lat: next.lat, lng: next.lng };
        setDbOrigin(next);
      },
      () => {
        // Keep default if permission denied/unavailable
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15000,
        timeout: 10000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const originForDbRounded = useMemo(
    () => ({ lat: round4(dbOrigin.lat), lng: round4(dbOrigin.lng) }),
    [dbOrigin.lat, dbOrigin.lng],
  );
  const q = query.trim().toLowerCase();

  const { data: dbNearby, error: dbError } = useQuery({
    queryKey: ['list-establishments', originForDbRounded.lat, originForDbRounded.lng, radiusKm, category, q],
    enabled: Number.isFinite(originForDbRounded.lat) && Number.isFinite(originForDbRounded.lng),
    queryFn: async () =>
      fetchEstablishmentsNearby({
        lat: originForDbRounded.lat,
        lng: originForDbRounded.lng,
        radiusKm,
        limit: radiusKm >= 200 ? 3000 : radiusKm >= 50 ? 1500 : radiusKm >= 25 ? 900 : 500,
        category,
        q: query.trim(),
      }),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const merged = useMemo(() => {
    const db = (dbNearby || []).map(toUiEstablishment);
    const seen = new Set<string>();
    const out = [];
    for (const e of [...db, ...staticEstablishments]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const d = haversineMeters(originForDbRounded, e.coordinates);
      out.push({ ...e, distanceMeters: d });
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
          (a.distanceMeters ?? haversineMeters(originForDbRounded, a.coordinates)) -
          (b.distanceMeters ?? haversineMeters(originForDbRounded, b.coordinates)),
      );
  }, [dbNearby, category, q, query, originForDbRounded.lat, originForDbRounded.lng]);

  const ranked = useMemo(() => rankEstablishmentSuggestions(query, merged, 8), [query, merged]);

  const categories = [
    { id: 'all', label: 'Tous' },
    ...ESTABLISHMENT_CATEGORIES,
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-4">
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">À proximité</h1>
        {dbError && (
          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold">DB/API indisponible</div>
            <div className="break-words">{String((dbError as any)?.message || dbError)}</div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Filtrer la liste..." 
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenSuggest(true);
            }}
            onFocus={() => setOpenSuggest(true)}
            onBlur={() => window.setTimeout(() => setOpenSuggest(false), 140)}
            className="w-full bg-secondary/50 border-none rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          />

          {openSuggest && ranked.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 z-20">
              <div className="rounded-2xl bg-background/95 backdrop-blur-xl border border-border shadow-xl overflow-hidden">
                <Command shouldFilter={false}>
                  <CommandList>
                    <CommandEmpty>Aucun résultat</CommandEmpty>
                    {ranked.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.name}
                        onSelect={() => {
                          setQuery(r.name);
                          setOpenSuggest(false);
                          setCategory('all');
                          setLocation(`/details/${r.id}`);
                        }}
                        className="flex items-center gap-3"
                      >
                        <img src={r.imageUrl} alt={r.name} className="h-8 w-8 rounded-lg object-cover border border-border" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{r.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.commune} • {r.categoryLabel}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </div>
            </div>
          )}
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
            {[5, 10, 25, 50, 200].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r as any)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  radiusKm === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/60 border-border text-foreground'
                }`}
              >
                {r === 200 ? "CI" : `${r}km`}
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
