/**
 * Navigation (guide)
 * In-app guidance screen: shows route polyline + live user location.
 * No backend changes (uses existing /api/establishments/:id + Google Directions API).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions, Linking, Platform } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEstablishmentById, toUiEstablishment } from '../services/establishments';
import { TravelMode } from '../services/directions';
import { fetchGoogleDirections } from '../services/directions';
import { fetchMapboxRoute } from '../services/mapboxDirections';
import { useCurrentLocation, useLocationStore } from '../stores/useLocationStore';
import { getCurrentLocation, watchLocation, formatDistance, haversineDistance, requestBackgroundLocationPermission } from '../services/location';
import Constants from 'expo-constants';
import { BottomSheet } from '../components/UI/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceImage } from '../components/UI/PlaceImage';
import { getPlaceFallbackImage } from '../services/placeFallbackImage';
import type { RouteStep } from '../services/mapboxDirections';
import type { Establishment } from '../types/establishment';
import { isNavigationBackgroundTrackingRunning, setNavigationSession, startNavigationBackgroundTracking, stopNavigationBackgroundTracking } from '../services/navigationBackground';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function bearingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} h ${mm} min`;
}

export default function NavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const id = params.id ? String(params.id) : '';
  const initialMode = (params.mode as TravelMode) || 'driving';
  const qc = useQueryClient();

  const userLocation = useCurrentLocation();
  const { hasPermission, setUserLocation, setIsTracking } = useLocationStore();
  const [mode, setMode] = useState<TravelMode>(initialMode);
  const [followUser, setFollowUser] = useState(true);
  const [autoReroute, setAutoReroute] = useState(true);
  const insets = useSafeAreaInsets();
  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [bgEnabled, setBgEnabled] = useState(true);
  const [bgRunning, setBgRunning] = useState(false);
  const [nextTurn, setNextTurn] = useState<{ title: string; subtitle: string } | null>(null);
  const [nearbyHint, setNearbyHint] = useState<{ title: string; subtitle: string } | null>(null);
  const [autoHideGuide, setAutoHideGuide] = useState(true);

  const mapRef = useRef<MapView>(null);
  const lastLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: userLocation.lat,
    longitude: userLocation.lng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });

  // Track GPS for navigation screen too
  useEffect(() => {
    let stopWatching: (() => void) | null = null;
    if (!hasPermission) return;

    getCurrentLocation().then((loc) => {
      setUserLocation(loc);
      // Freeze origin once (for stable routing + offline follow)
      setRouteOrigin((o) => o ?? { lat: loc.lat, lng: loc.lng });
      setRegion((r) => ({ ...r, latitude: loc.lat, longitude: loc.lng }));
    });

    watchLocation((loc) => {
      setUserLocation(loc);
      setRouteOrigin((o) => o ?? { lat: loc.lat, lng: loc.lng });
      if (followUser) {
        // Keep the cursor centered (navigation feel).
        // IMPORTANT: On iOS, react-native-maps often ignores `zoom` and relies on `altitude`.
        // So we set both to prevent the "zoom drifting away" feeling.
        const last = lastLocRef.current;
        const heading = last ? bearingDeg(last, loc) : 0;
        lastLocRef.current = loc;
        const altitude =
          mode === 'walking'
            ? 260
            : mode === 'bicycling'
              ? 360
              : 520;
        const zoom = mode === 'walking' ? 18.2 : mode === 'bicycling' ? 17.6 : 17.0;
        const pitch = mode === 'walking' ? 52 : 60;
        mapRef.current?.animateCamera(
          {
            center: { latitude: loc.lat, longitude: loc.lng },
            pitch,
            heading,
            zoom,
            altitude,
          },
          { duration: 280 },
        );
      }
    }).then((stop) => {
      stopWatching = stop;
    });

    setIsTracking(true);
    return () => {
      stopWatching?.();
      setIsTracking(false);
    };
  }, [hasPermission, followUser, setIsTracking, setUserLocation]);

  const { data: establishment, isLoading: estLoading, error: estError } = useQuery({
    queryKey: ['establishment', id],
    enabled: !!id,
    queryFn: async () => {
      const api = await fetchEstablishmentById(id);
      if (!api) throw new Error('Établissement introuvable');
      return toUiEstablishment(api);
    },
  });

  const originKey = useMemo(() => {
    const o = routeOrigin ?? userLocation;
    // Round so we don't create infinite keys; also helps offline cache reuse.
    const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
    return { lat: r4(o.lat), lng: r4(o.lng) };
  }, [routeOrigin, userLocation]);

  const { data: route, isLoading: routeLoading, error: routeError } = useQuery({
    queryKey: ['directions', id, originKey.lat, originKey.lng, mode],
    enabled: !!establishment && !!originKey,
    queryFn: async () => {
      const hasMapbox =
        !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
        !!(Constants.expoConfig as any)?.extra?.mapbox?.token;

      // Preferred: Mapbox (richer steps). If not configured, fallback to Google Directions API.
      if (hasMapbox) {
        const r = await fetchMapboxRoute({
          origin: { lat: originKey.lat, lng: originKey.lng },
          destination: { lat: establishment!.coordinates.lat, lng: establishment!.coordinates.lng },
          mode: mode === 'bicycling' ? 'cycling' : mode,
        });
        if (!r) throw new Error("Itinéraire indisponible (Mapbox)");
        return {
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSeconds,
          polyline: r.geometry,
          steps: r.steps,
        };
      }

      const googleKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
      const g = await fetchGoogleDirections({
        origin: { lat: originKey.lat, lng: originKey.lng },
        destination: { lat: establishment!.coordinates.lat, lng: establishment!.coordinates.lng },
        mode: mode === 'bicycling' ? 'bicycling' : mode,
        apiKey: googleKey,
      });
      return {
        distanceMeters: g.distanceMeters,
        durationSeconds: g.durationSeconds,
        polyline: g.polyline,
        // normalize to RouteStep shape used in UI
        steps: g.steps.map((s) => ({
          distanceMeters: s.distanceMeters,
          durationSeconds: s.durationSeconds,
          instruction: s.instruction,
          maneuver: { location: [0, 0], type: 'turn' },
        })),
      };
    },
    staleTime: 1000 * 10, // 10s
    gcTime: 1000 * 60 * 10,
    // Keep last route visible while recalculating (avoids "route disappears" on mode switch)
    placeholderData: (prev) => prev,
  });

  const polyline = route?.polyline || [];
  const steps: RouteStep[] = (route?.steps as any) || [];

  function offRouteThresholdM(): number {
    if (mode === 'driving') return 90;
    if (mode === 'bicycling') return 55;
    return 40;
  }

  function nearestPolylineIndex(user: { lat: number; lng: number }, pts: Array<{ lat: number; lng: number }>): number {
    if (!pts.length) return 0;
    const maxCheck = 220;
    const step = Math.max(1, Math.ceil(pts.length / maxCheck));
    let bestIdx = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pts.length; i += step) {
      const d = haversineDistance(user, pts[i]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    // refine around bestIdx window
    const start = Math.max(0, bestIdx - step * 2);
    const end = Math.min(pts.length - 1, bestIdx + step * 2);
    for (let i = start; i <= end; i++) {
      const d = haversineDistance(user, pts[i]);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  const remainingPolyline = useMemo(() => {
    if (!polyline.length) return [];
    // When following, show remaining route for a "progressing" feel.
    if (!followUser) return polyline;
    const idx = nearestPolylineIndex(userLocation, polyline as any);
    const start = clamp(idx - 1, 0, Math.max(0, polyline.length - 1));
    return polyline.slice(start);
  }, [followUser, polyline, userLocation.lat, userLocation.lng]);

  const lastRerouteRef = useRef<{ at: number; from: { lat: number; lng: number } } | null>(null);
  const offRouteStreakRef = useRef(0);
  useEffect(() => {
    if (!autoReroute) return;
    if (!followUser) return;
    if (!polyline || polyline.length < 6) return;
    if (routeLoading) return;
    const idx = nearestPolylineIndex(userLocation, polyline as any);
    const near = polyline[idx];
    if (!near) return;
    const d = haversineDistance(userLocation, near);
    const threshold = offRouteThresholdM();
    if (!(d > threshold)) {
      offRouteStreakRef.current = 0;
      return;
    }
    // Require stable off-route for 2 consecutive checks (prevents GPS jitter triggering reroute).
    offRouteStreakRef.current = Math.min(5, offRouteStreakRef.current + 1);
    if (offRouteStreakRef.current < 2) return;

    const now = Date.now();
    const last = lastRerouteRef.current;
    // Cooldown + avoid reroute if user hasn't moved much since last reroute
    if (last) {
      if (now - last.at < 18_000) return;
      const movedSince = haversineDistance(last.from, userLocation);
      if (movedSince < Math.max(35, threshold * 0.6)) return;
    }
    // Reroute from current position
    lastRerouteRef.current = { at: now, from: { lat: userLocation.lat, lng: userLocation.lng } };
    offRouteStreakRef.current = 0;
    turnRef.current.nextIdx = 0;
    turnRef.current.lastAnnouncedIdx = -1;
    turnRef.current.lastAnnouncedAt = 0;
    didFitRef.current = false;
    setRouteOrigin({ lat: userLocation.lat, lng: userLocation.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReroute, followUser, mode, polyline.length, userLocation.lat, userLocation.lng, routeLoading]);
  const { height: screenH } = Dimensions.get('window');
  const sheetSnaps = useMemo(() => {
    // Allow full hide so the map stays fully usable while route is shown.
    const min = 0;
    const peek = 140;
    const mid = Math.min(420, Math.max(320, Math.round(screenH * 0.42)));
    const max = Math.min(Math.round(screenH * 0.82), 760);
    return [min, peek, mid, max];
  }, [screenH]);
  const [sheetIndex, setSheetIndex] = useState(0);

  const fitRoute = () => {
    if (!mapRef.current || !establishment || polyline.length < 2) return;
    const bottomPad = Math.min(420, Math.max(220, sheetSnaps[sheetIndex] + 60));
    mapRef.current.fitToCoordinates(
      polyline.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      {
        edgePadding: { top: 90, right: 40, bottom: bottomPad, left: 40 },
        animated: true,
      },
    );
  };

  // Fit route only on first load OR when user explicitly requests it.
  const didFitRef = useRef(false);
  useEffect(() => {
    if (polyline.length < 2) return;
    if (didFitRef.current) return;
    didFitRef.current = true;
    const t = setTimeout(() => {
      // If user wants follow mode, don't zoom out too much; keep it closer.
      if (followUser) {
        mapRef.current?.animateCamera(
          {
            center: { latitude: userLocation.lat, longitude: userLocation.lng },
            pitch: mode === 'walking' ? 52 : 60,
            zoom: mode === 'walking' ? 18.2 : mode === 'bicycling' ? 17.6 : 17.0,
            altitude: mode === 'walking' ? 260 : mode === 'bicycling' ? 360 : 520,
          },
          { duration: 400 },
        );
      } else {
        fitRoute();
      }
    }, 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline.length]);

  const headerTitle = useMemo(() => {
    if (establishment?.name) return establishment.name;
    return 'Itinéraire';
  }, [establishment?.name]);
  const cover = useMemo(() => {
    const photos = Array.isArray((establishment as any)?.photos) ? (establishment as any).photos : [];
    const first = photos.find((p: any) => typeof p === 'string' && String(p).trim().length > 0) ?? null;
    return first || (establishment as any)?.imageUrl || null;
  }, [establishment]);
  // Establishment can be undefined during initial render (hooks must still run).
  const photoFallback = useMemo(
    () => getPlaceFallbackImage((establishment as any)?.category || 'restaurant'),
    [(establishment as any)?.category],
  );
  const modeLabel = useMemo(() => {
    if (mode === 'driving') return 'Voiture';
    if (mode === 'walking') return 'À pied';
    if (mode === 'bicycling') return 'Vélo';
    return 'Mode';
  }, [mode]);

  // Pull establishments from cache (map/list queries) for "nearby suggestions" during navigation.
  const cachedPlacesRef = useRef<Establishment[]>([]);
  const suggestedRef = useRef<Map<string, number>>(new Map());
  const turnRef = useRef<{ nextIdx: number; lastAnnouncedIdx: number; lastAnnouncedAt: number }>({
    nextIdx: 0,
    lastAnnouncedIdx: -1,
    lastAnnouncedAt: 0,
  });

  const refreshCachedPlaces = () => {
    const keys: any[] = [['establishments'], ['list-establishments'], ['events-establishments'], ['pro-establishments-preview']];
    const out: Establishment[] = [];
    const seen = new Set<string>();
    for (const k of keys) {
      const all = qc.getQueriesData({ queryKey: k });
      for (const [, value] of all) {
        const arr = Array.isArray(value) ? value : (value as any)?.establishments || value;
        if (!Array.isArray(arr)) continue;
        for (const e of arr) {
          const id = String((e as any)?.id || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push(e as any);
        }
      }
    }
    cachedPlacesRef.current = out;
  };

  function distanceToManeuverMeters(user: { lat: number; lng: number }, step: RouteStep): number {
    const loc = step?.maneuver?.location;
    if (!loc || loc.length < 2) return Number.POSITIVE_INFINITY;
    const to = { lat: Number(loc[1]), lng: Number(loc[0]) };
    if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return Number.POSITIVE_INFINITY;
    return haversineDistance(user, to);
  }

  function computeTurnText(step: RouteStep, distM: number) {
    const mod = String(step?.maneuver?.modifier || '').toLowerCase();
    const isLeft = mod.includes('left') || mod.includes('gauche');
    const isRight = mod.includes('right') || mod.includes('droite');
    const dir = isLeft ? 'à gauche' : isRight ? 'à droite' : '';
    const title = dir ? `Tournez ${dir}` : 'Prochaine étape';
    const subtitle = `${step.instruction || 'Continuez'} • ${formatDistance(distM)}`;
    return { title, subtitle };
  }

  function turnThresholdM(): number {
    if (mode === 'driving') return 120;
    if (mode === 'bicycling') return 70;
    return 45;
  }

  // Live: compute next turn banner + suggestions (foreground).
  useEffect(() => {
    if (!steps.length) return;

    // Ensure cache is loaded (cheap in-memory scan)
    refreshCachedPlaces();

    const tr = turnRef.current;
    const idx = Math.max(0, Math.min(tr.nextIdx, steps.length - 1));
    const step = steps[idx];
    const dist = distanceToManeuverMeters(userLocation, step);

    // Advance step if passed
    if (dist < 18 && idx < steps.length - 1) {
      tr.nextIdx = idx + 1;
    }

    // Update banner (always)
    setNextTurn(computeTurnText(step, dist));

    // Suggest nearby places (bars/caves/lounges) when passing close; throttle per place.
    const now = Date.now();
    const places = cachedPlacesRef.current || [];
    if (places.length) {
      const interesting = new Set(['bar', 'cave', 'lounge', 'maquis']);
      let best: { e: Establishment; d: number } | null = null;
      for (const e of places) {
        if (!interesting.has(String((e as any).category || '').toLowerCase())) continue;
        const d = haversineDistance(userLocation, (e as any).coordinates);
        if (d > 140) continue;
        if (!best || d < best.d) best = { e, d };
      }
      if (best) {
        const last = suggestedRef.current.get(best.e.id) || 0;
        if (now - last > 4 * 60_000) {
          suggestedRef.current.set(best.e.id, now);
          setNearbyHint({
            title: 'À proximité',
            subtitle: `${best.e.name} • ${formatDistance(best.d)}`,
          });
          // Auto-hide
          setTimeout(() => setNearbyHint(null), 6500);
        }
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation.lat, userLocation.lng, steps.length, mode]);

  // Background tracking (turn alerts while app is backgrounded)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!hasPermission) return;
      // Only start when we have a real route with steps.
      if (!bgEnabled || !steps.length || !establishment) {
        setNavigationSession({ active: false, mode, steps: [] });
        if (alive) setBgRunning(await isNavigationBackgroundTrackingRunning());
        return;
      }

      setNavigationSession({
        active: true,
        mode,
        destinationName: establishment.name,
        steps,
      });

      const bgPerm = await requestBackgroundLocationPermission();
      if (!bgPerm.granted) {
        if (alive) setBgRunning(false);
        return;
      }

      await startNavigationBackgroundTracking();
      if (alive) setBgRunning(await isNavigationBackgroundTrackingRunning());
    })();
    return () => {
      alive = false;
      // Stop background tracking when leaving navigation screen
      void stopNavigationBackgroundTracking();
      setNavigationSession({ active: false, mode, steps: [] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgEnabled, hasPermission, steps.length, establishment?.id, mode]);

  // Keep the map first: optionally auto-hide the Guide after a short delay while following.
  useEffect(() => {
    if (!autoHideGuide) return;
    if (!followUser) return;
    if (sheetIndex === 0) return;
    const t = setTimeout(() => setSheetIndex(0), 3200);
    return () => clearTimeout(t);
  }, [autoHideGuide, followUser, sheetIndex]);

  if (estLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.centerText}>Chargement de la destination…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!id || estError || !establishment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Navigation indisponible</Text>
          <Text style={styles.errorText}>{String((estError as any)?.message || estError || 'ID manquant')}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        mapType="standard"
        onPanDrag={() => setFollowUser(false)}
        showsUserLocation={hasPermission}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled
        rotateEnabled
        showsBuildings
        showsTraffic={false}
      >
        <Marker
          coordinate={{ latitude: establishment.coordinates.lat, longitude: establishment.coordinates.lng }}
          title={establishment.name}
        />
        {polyline.length >= 2 && (
          <>
            {/* Outline for premium look */}
            <Polyline
              coordinates={(remainingPolyline.length ? remainingPolyline : polyline).map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeWidth={10}
              strokeColor="rgba(11,18,32,0.55)"
            />
            <Polyline
              coordinates={(remainingPolyline.length ? remainingPolyline : polyline).map((p) => ({ latitude: p.lat, longitude: p.lng }))}
              strokeWidth={6}
              strokeColor="#2563eb"
            />
          </>
        )}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.safeOverlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Text style={styles.topBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <TouchableOpacity style={styles.topBtn} onPress={fitRoute}>
            <Text style={styles.topBtnText}>⌖</Text>
          </TouchableOpacity>
        </View>

        {!!nextTurn && polyline.length >= 2 && (
          <View style={styles.turnBanner}>
            <Text style={styles.turnTitle} numberOfLines={1}>
              {nextTurn.title}
            </Text>
            <Text style={styles.turnSub} numberOfLines={2}>
              {nextTurn.subtitle}
            </Text>
          </View>
        )}

        {!!nearbyHint && (
          <View style={styles.nearbyBanner}>
            <Text style={styles.nearbyTitle}>{nearbyHint.title}</Text>
            <Text style={styles.nearbySub} numberOfLines={1}>
              {nearbyHint.subtitle}
            </Text>
          </View>
        )}
      </SafeAreaView>

      <BottomSheet
        snapPoints={sheetSnaps}
        initialSnapIndex={0}
        snapToIndex={sheetIndex}
        // No backdrop: keep the map readable and interactive.
        backdrop={false}
        bottomOffset={insets.bottom}
        onSnapIndexChange={(idx) => setSheetIndex(idx)}
      >
        {sheetIndex === 0 ? (
          <View />
        ) : (
          <>
            <View style={styles.destCard}>
              <PlaceImage
                uri={cover}
                fallbackSource={photoFallback}
                id={establishment.id}
                name={establishment.name}
                category={establishment.category}
                style={styles.destImage}
              />
              <View style={styles.destBody}>
                <Text style={styles.destName} numberOfLines={1}>
                  {establishment.name}
                </Text>
                <Text style={styles.destMeta} numberOfLines={1}>
                  {establishment.category} • {establishment.commune || '—'}
                </Text>
                <Text style={styles.destMetaSmall} numberOfLines={1}>
                  {establishment.address || ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.collapseBtn} onPress={() => setSheetIndex(0)}>
                <Text style={styles.collapseBtnText}>˅</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Guide</Text>
              <Text style={styles.sheetMeta}>
                {routeLoading ? 'Calcul…' : route ? `${formatDistance(route.distanceMeters)} • ${formatDuration(route.durationSeconds)}` : '—'}
              </Text>
            </View>

            {!!routeError && (
              <View style={styles.warn}>
                <Text style={styles.warnTitle}>Itinéraire indisponible</Text>
                <Text style={styles.warnText}>{String((routeError as any)?.message || routeError)}</Text>
                {!(Constants.expoConfig as any)?.extra?.mapbox?.token && !process.env.EXPO_PUBLIC_MAPBOX_TOKEN && (
                  <Text style={styles.warnTextSmall}>
                    Configure `VITE_MAPBOX_TOKEN` (repo root .env) ou `EXPO_PUBLIC_MAPBOX_TOKEN` pour activer Directions.
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.warnCta}
                  onPress={() => {
                    const dest = `${establishment.coordinates.lat},${establishment.coordinates.lng}`;
                    const googleMode = mode === 'bicycling' ? 'bicycling' : mode;
                    const url =
                      Platform.OS === 'ios'
                        ? `http://maps.apple.com/?daddr=${encodeURIComponent(dest)}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${encodeURIComponent(googleMode)}&dir_action=navigate`;
                    Linking.openURL(url);
                  }}
                >
                  <Text style={styles.warnCtaText}>Ouvrir dans Maps</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modes}>
              <ModeBtn
                active={mode === 'driving'}
                label="Voiture"
                onPress={() => {
                  setMode('driving');
                  setFollowUser(true);
                }}
              />
              <ModeBtn
                active={mode === 'walking'}
                label="À pied"
                onPress={() => {
                  setMode('walking');
                  setFollowUser(true);
                }}
              />
              <ModeBtn
                active={mode === 'bicycling'}
                label="Vélo"
                onPress={() => {
                  setMode('bicycling');
                  setFollowUser(true);
                }}
              />
            </View>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.secondary, followUser && styles.secondaryActive]} onPress={() => setFollowUser((v) => !v)}>
                <Text style={[styles.secondaryText, followUser && styles.secondaryTextActive]}>{followUser ? 'Suivi: ON' : 'Suivi: OFF'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primary} onPress={fitRoute}>
                <Text style={styles.primaryText}>Recentrer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.secondary, autoReroute && styles.secondaryActive]}
                onPress={() => setAutoReroute((v) => !v)}
              >
                <Text style={[styles.secondaryText, autoReroute && styles.secondaryTextActive]}>
                  Recalcul auto: {autoReroute ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => {
                  didFitRef.current = false;
                  turnRef.current.nextIdx = 0;
                  setRouteOrigin({ lat: userLocation.lat, lng: userLocation.lng });
                }}
              >
                <Text style={styles.secondaryText}>Recalculer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.secondary, bgEnabled && styles.secondaryActive]}
                onPress={() => setBgEnabled((v) => !v)}
              >
                <Text style={[styles.secondaryText, bgEnabled && styles.secondaryTextActive]}>
                  Arrière‑plan: {bgEnabled && bgRunning ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondary, autoHideGuide && styles.secondaryActive]}
                onPress={() => setAutoHideGuide((v) => !v)}
              >
                <Text style={[styles.secondaryText, autoHideGuide && styles.secondaryTextActive]}>
                  Auto‑hide: {autoHideGuide ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            {steps.length > 0 && (
              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>Étapes</Text>
                <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false}>
                  {steps.slice(0, 28).map((s, idx) => (
                    <View key={`${idx}-${String(s.instruction || '')}`} style={styles.stepRow}>
                      <Text style={styles.stepIdx}>{idx + 1}</Text>
                      <View style={styles.stepBody}>
                        <Text style={styles.stepText}>{s.instruction || 'Continuer'}</Text>
                        <Text style={styles.stepMeta}>
                          {formatDistance(s.distanceMeters)} • {formatDuration(s.durationSeconds)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </BottomSheet>

      {/* Floating "Guide" button when sheet is hidden (does not block the map). */}
      {sheetIndex === 0 && (
        <SafeAreaView pointerEvents="box-none" style={styles.guideFabWrap}>
          <TouchableOpacity activeOpacity={0.92} style={styles.guideFab} onPress={() => setSheetIndex(1)}>
            <Text style={styles.guideFabTitle}>Guide</Text>
            <Text style={styles.guideFabMeta} numberOfLines={1}>
              {modeLabel} • {routeLoading ? 'Calcul…' : route ? `${formatDistance(route.distanceMeters)} • ${formatDuration(route.durationSeconds)}` : '—'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

function ModeBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.modeBtn, active && styles.modeBtnActive]}>
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  guideFabWrap: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  guideFab: {
    backgroundColor: 'rgba(11,18,32,0.88)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  guideFabTitle: { color: '#fff', fontWeight: '950', fontSize: 13 },
  guideFabMeta: { marginTop: 2, color: 'rgba(255,255,255,0.74)', fontWeight: '800', fontSize: 12 },
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: '#0b1220' },
  safeOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  centerText: { marginTop: 10, color: '#64748b' },
  errorTitle: { color: '#0b1220', fontWeight: '900', fontSize: 18, marginBottom: 6 },
  errorText: { color: '#0b1220', opacity: 0.7, textAlign: 'center' },
  backBtn: { marginTop: 14, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  backBtnText: { color: '#fff', fontWeight: '900' },
  topBar: {
    marginTop: 8,
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(11,18,32,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' },
  topBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  topTitle: { flex: 1, color: '#fff', fontWeight: '900', fontSize: 14 },
  turnBanner: {
    marginTop: 10,
    marginHorizontal: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(11,18,32,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  turnTitle: { color: '#fff', fontWeight: '950', fontSize: 14 },
  turnSub: { marginTop: 2, color: 'rgba(255,255,255,0.78)', fontWeight: '800', fontSize: 12, lineHeight: 16 },
  nearbyBanner: {
    marginTop: 8,
    marginHorizontal: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.45)',
  },
  nearbyTitle: { color: '#fff', fontWeight: '950', fontSize: 12, textTransform: 'uppercase' },
  nearbySub: { marginTop: 2, color: 'rgba(255,255,255,0.84)', fontWeight: '900', fontSize: 13 },
  // sheet container is now handled by BottomSheet
  destCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 10,
    alignItems: 'center',
  },
  destImage: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#111827' },
  destBody: { flex: 1, justifyContent: 'center' },
  destName: { color: '#fff', fontWeight: '900', fontSize: 14 },
  destMeta: { color: 'rgba(255,255,255,0.75)', fontWeight: '800', fontSize: 12, marginTop: 2 },
  destMetaSmall: { color: 'rgba(255,255,255,0.55)', fontWeight: '700', fontSize: 11, marginTop: 2 },
  collapseBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  collapseBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: -2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  sheetTitle: { color: '#fff', fontWeight: '900', fontSize: 18 },
  sheetMeta: { color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 13 },
  warn: { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.35)', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  warnTitle: { color: '#fff', fontWeight: '900', marginBottom: 4 },
  warnText: { color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 16 },
  warnTextSmall: { color: 'rgba(255,255,255,0.70)', fontSize: 11, marginTop: 6 },
  warnCta: { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  warnCtaText: { color: '#0b2a6b', fontWeight: '900', fontSize: 12 },
  modes: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  modeBtnText: { color: 'rgba(255,255,255,0.75)', fontWeight: '900', fontSize: 12 },
  modeBtnTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondary: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  secondaryActive: { backgroundColor: 'rgba(37,99,235,0.25)', borderColor: 'rgba(37,99,235,0.45)' },
  secondaryText: { color: 'rgba(255,255,255,0.75)', fontWeight: '900' },
  secondaryTextActive: { color: '#fff' },
  primary: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#0b2a6b', fontWeight: '900' },
  steps: { marginTop: 6, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  stepsTitle: { color: '#fff', fontWeight: '900', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  stepsScroll: { maxHeight: 190, backgroundColor: 'rgba(255,255,255,0.04)' },
  stepRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  stepIdx: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, color: '#0b1220', backgroundColor: '#fff', fontWeight: '900', overflow: 'hidden' as any },
  stepBody: { flex: 1 },
  stepText: { color: '#fff', fontWeight: '800', fontSize: 12, lineHeight: 16 },
  stepMeta: { color: 'rgba(255,255,255,0.65)', fontWeight: '700', fontSize: 11, marginTop: 2 },
});


