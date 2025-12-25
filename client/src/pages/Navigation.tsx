import React, { useRef, useState, useEffect } from 'react';
import MapView from '@/components/Map';
import { establishments } from '@/lib/data';
import { ArrowLeft, Crosshair, Phone, MapPin, Navigation, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type RouteInfo, formatDistance, formatDuration } from '@/lib/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchEstablishmentById, fetchEstablishmentsNearby, toUiEstablishment } from '@/lib/establishmentsApi';
import { haversineMeters } from '@/lib/geo';
import { telHref } from '@/lib/contact';
import walkGif from "@assets/walk.gif";
import veloGif from "@assets/velo.gif";
import voitureGif from "@assets/voiture.gif";

export default function NavigationPage() {
  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const id = sp.get('id');
  const modeParam = sp.get('mode');
  const slat = Number(sp.get('slat'));
  const slng = Number(sp.get('slng'));
  
  const local = establishments.find(e => e.id === id);
  const [establishment, setEstablishment] = useState(local);
  const [loadingEst, setLoadingEst] = useState(!local);
  const [userLoc, setUserLoc] = useState(() => {
    if (Number.isFinite(slat) && Number.isFinite(slng)) return { lat: slat, lng: slng };
    return { lat: 5.3261, lng: -4.0200 };
  });
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null | undefined>(undefined);
  const [accuracyM, setAccuracyM] = useState<number | undefined>(undefined);
  const [heading, setHeading] = useState<number | null>(null);
  const [navActive, setNavActive] = useState(false);
  const [routeEnabled, setRouteEnabled] = useState(true);
  const [navMapStyle, setNavMapStyle] = useState<'navigation' | 'satellite'>('navigation');
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'cycling'>(
    modeParam === 'walking' ? 'walking' : modeParam === 'cycling' ? 'cycling' : 'driving',
  );
  const [recenterSeq, setRecenterSeq] = useState(0);
  const lastGpsRef = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const lastAccRef = useRef<number | null>(null);

  const tel = telHref(establishment?.phone ?? null);

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
            if (now - last.t < 200 && moved < 3) {
              setAccuracyM(acc);
              setHeading(position.coords.heading ?? null);
              return;
            }

            // Ignore very suspicious jumps when accuracy is poor (common on mobile).
            const lastAcc = lastAccRef.current;
            if (typeof acc === "number" && acc > 60 && moved > 40 && now - last.t < 1200) {
              setAccuracyM(acc);
              setHeading(position.coords.heading ?? null);
              return;
            }
            if (lastAcc && acc && acc > lastAcc * 1.8 && moved > 25 && now - last.t < 1200) {
              setAccuracyM(acc);
              setHeading(position.coords.heading ?? null);
              return;
            }
          }
          lastGpsRef.current = { t: now, lat: next.lat, lng: next.lng };
          lastAccRef.current = acc ?? null;
          setUserLoc(next);
          setAccuracyM(acc);
          setHeading(position.coords.heading ?? null);
        },
        () => {
          // Keep default if permission denied/unavailable
          setUserLoc({ lat: 5.3261, lng: -4.0200 });
          setAccuracyM(undefined);
          setHeading(null);
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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!id) return;
      const found = establishments.find((e) => e.id === id);
      if (found) {
        setEstablishment(found);
        setLoadingEst(false);
        return;
      }
      setLoadingEst(true);
      try {
        const api = await fetchEstablishmentById(id);
        if (!alive) return;
        setEstablishment(api ? toUiEstablishment(api) : undefined);
      } finally {
        if (alive) setLoadingEst(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const openExternalNavigation = () => {
    if (!establishment) return;
    const destination = `${establishment.coordinates.lat},${establishment.coordinates.lng}`;

    // Mobile-first: omit `origin` so Google Maps uses the phone's native GPS location,
    // which is often much more accurate than browser geolocation over Wi‑Fi IP HTTP.
    const googleMode = travelMode === "cycling" ? "bicycling" : travelMode;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination,
    )}&travelmode=${googleMode}&dir_action=navigate`;
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  if (!establishment) {
    return (
      <div className="p-8 text-center text-foreground">
        {loadingEst ? "Chargement…" : "Établissement non trouvé"}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background relative flex flex-col">
      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapView 
          userLocation={userLoc}
          highlightedId={id || ''}
          onRouteInfoChange={setRouteInfo}
          followUser={navActive}
          userHeading={heading}
          navMapStyle={navMapStyle}
          recenterSeq={recenterSeq}
          routeMode={travelMode}
          routeEnabled={routeEnabled}
          establishmentsData={establishment ? [establishment, ...establishments] : establishments}
        />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background/80 to-transparent flex items-center space-x-3">
        <button 
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-background/40 backdrop-blur-md flex items-center justify-center text-foreground hover:bg-background/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-foreground truncate">{establishment.name}</h1>
          <p className="text-xs text-muted-foreground capitalize">{establishment.category}</p>
        </div>
      </div>

      {/* Bottom UI */}
      {!navActive ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent p-6 pb-safe">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            {/* Establishment Header */}
            <div className="flex items-center gap-3">
              <img
                src={establishment.imageUrl}
                alt={establishment.name}
                className="h-12 w-12 rounded-xl object-cover border border-border"
              />
              <div className="min-w-0">
                <h2 className="font-display font-bold text-lg text-foreground truncate">{establishment.name}</h2>
                <div className="flex items-center text-muted-foreground text-xs truncate">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  <span className="truncate">{establishment.address}</span>
                </div>
              </div>
            </div>

            {/* Distance Info */}
            {routeInfo === undefined && (
              <div className="rounded-xl bg-secondary/40 border border-border p-3 flex items-center gap-3">
                <img
                  src={travelMode === "walking" ? walkGif : travelMode === "cycling" ? veloGif : voitureGif}
                  alt={travelMode === "walking" ? "Marche" : travelMode === "cycling" ? "Vélo" : "Voiture"}
                  className="h-10 w-10 object-contain"
                />
                <div className="text-sm font-semibold text-foreground">Calcul de l’itinéraire…</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Distance</p>
                <p className="text-base font-bold text-primary">
                  {routeInfo === undefined
                    ? 'Calcul...'
                    : routeInfo === null
                      ? 'Indispo'
                      : formatDistance(routeInfo.distance)}
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Durée</p>
                <p className="text-base font-bold text-primary">
                  {routeInfo === undefined
                    ? 'Calcul...'
                    : routeInfo === null
                      ? 'Indispo'
                      : formatDuration(routeInfo.duration)}
                </p>
              </div>
            </div>

            {accuracyM !== undefined && (
              <p className="text-xs text-muted-foreground">
                Précision localisation: ~{Math.round(accuracyM)} m
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTravelMode('driving')}
                  className={`px-3 h-12 rounded-xl text-xs font-bold border ${
                    travelMode === 'driving'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border'
                  }`}
                >
                  Voiture
                </button>
                <button
                  type="button"
                  onClick={() => setTravelMode('walking')}
                  className={`px-3 h-12 rounded-xl text-xs font-bold border ${
                    travelMode === 'walking'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border'
                  }`}
                >
                  À pied
                </button>
                <button
                  type="button"
                  onClick={() => setTravelMode('cycling')}
                  className={`px-3 h-12 rounded-xl text-xs font-bold border ${
                    travelMode === 'cycling'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border'
                  }`}
                >
                  Vélo
                </button>
              </div>
              {tel ? (
                <Button asChild className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl">
                  <a href={tel}>
                    <Phone className="w-4 h-4 mr-2" />
                    Appeler
                  </a>
                </Button>
              ) : (
                <Button disabled className="flex-1 bg-green-600 text-white font-bold h-12 rounded-xl">
                  <Phone className="w-4 h-4 mr-2" />
                  Appeler
                </Button>
              )}
              <Button
                onClick={() => {
                  setRouteEnabled(true);
                  setNavActive(true);
                }}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Démarrer
              </Button>
            </div>

            <button
              type="button"
              onClick={openExternalNavigation}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Ouvrir dans Google Maps (optionnel)
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe pointer-events-none">
          <div className="mx-auto max-w-xl pb-4 pointer-events-auto">
            <div className="rounded-2xl bg-background/90 backdrop-blur-xl border border-border shadow-xl p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src="" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">Navigation</div>
                <div className="text-sm font-semibold truncate">
                  {routeInfo ? `${formatDistance(routeInfo.distance)} • ${formatDuration(routeInfo.duration)}` : "En cours…"}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  variant="outline"
                  className="h-10 px-3"
                  onClick={() => setRecenterSeq((n) => n + 1)}
                >
                  <Crosshair className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Recentrer</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-10 px-3"
                  onClick={() => setNavMapStyle((v) => (v === 'navigation' ? 'satellite' : 'navigation'))}
                >
                  <Satellite className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{navMapStyle === 'satellite' ? 'Route' : 'Satellite'}</span>
                </Button>
                <img
                  src={establishment.imageUrl}
                  alt={establishment.name}
                  className="h-10 w-10 rounded-xl object-cover border border-border"
                />
                <Button
                  variant="destructive"
                  className="h-10 px-3"
                  onClick={() => {
                    setNavActive(false);
                    // As requested: once user stops, we can hide the route.
                    setRouteEnabled(false);
                  }}
                >
                  Stop
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
