import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  type MapRef,
  Marker,
  NavigationControl,
  GeolocateControl,
  Popup,
  ViewStateChangeEvent,
  Source,
  Layer,
} from 'react-map-gl';
import { establishments as defaultEstablishments, type Establishment } from '@/lib/data';
import { CalendarClock, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import RouteLayer from './RouteLayer';
import { RouteInfo, formatDistance, formatDuration } from '@/lib/routing';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type EstablishmentEvent } from '@/lib/events';
import { haversineMeters } from '@/lib/geo';
import { MAPBOX_TOKEN } from '@/lib/mapbox';
import { getCategoryIcon } from '@/lib/categories';

interface MapViewProps {
  interactive?: boolean;
  userLocation?: { lat: number; lng: number };
  highlightedId?: string;
  onRouteInfoChange?: (route: RouteInfo | null | undefined) => void;
  establishmentsData?: Establishment[];
  followUser?: boolean;
  userHeading?: number | null;
  events?: Array<EstablishmentEvent & { establishment: Establishment }>;
  navMapStyle?: 'navigation' | 'satellite';
  recenterSeq?: number;
  routeMode?: 'driving' | 'walking' | 'cycling';
  // Allow parent pages (e.g. /navigation) to hide the route when user stops navigation.
  routeEnabled?: boolean;
}

export default function MapView({
  interactive = true,
  userLocation,
  highlightedId,
  onRouteInfoChange,
  establishmentsData,
  followUser = false,
  userHeading = null,
  events = [],
  navMapStyle = 'navigation',
  recenterSeq = 0,
  routeMode = 'driving',
  routeEnabled = true,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const lastFollowRef = useRef<{ t: number; lat: number; lng: number; bearing: number } | null>(null);
  const lastUserGestureRef = useRef<number>(0);
  const lastFitKeyRef = useRef<string | null>(null);
  const routeProgressRef = useRef<{
    coords: Array<[number, number]>;
    cum: number[];
    total: number;
  } | null>(null);
  const lastNearestIdxRef = useRef<number>(0);
  const [viewState, setViewState] = useState({
    latitude: 5.3261,
    longitude: -4.0200,
    zoom: 13,
    bearing: 0,
    pitch: 0
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  // undefined = loading/unknown, null = failed/unavailable, RouteInfo = success
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null | undefined>(undefined);
  const [legendOpen, setLegendOpen] = useState(false);

  const userLoc = userLocation || { lat: 5.3261, lng: -4.0200 };
  const establishments = establishmentsData ?? defaultEstablishments;
  const selectedEstablishment = establishments.find(e => e.id === selectedId);
  const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);

  const establishmentsGeojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: establishments.map((e) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [e.coordinates.lng, e.coordinates.lat] as [number, number],
        },
        properties: {
          id: e.id,
          category: e.category,
          name: e.name,
          address: e.address ?? "",
          commune: e.commune ?? "",
        },
      })),
    };
  }, [establishments]);

  const routeBounds = useMemo(() => {
    if (!routeInfo || routeInfo.geometry.length === 0) return null;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of routeInfo.geometry) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ] as [[number, number], [number, number]];
  }, [routeInfo]);

  // Update selectedId when highlightedId prop changes
  useEffect(() => {
    if (highlightedId) {
      setSelectedId(highlightedId);
      setRouteInfo(undefined);
      setHasCenteredOnUser(true); // avoid snapping back to user while navigating
      // Auto-zoom to establishment when highlighted
      const est = establishments.find(e => e.id === highlightedId);
      if (est) {
        setViewState(prev => ({
          ...prev,
          latitude: est.coordinates.lat,
          longitude: est.coordinates.lng,
          zoom: 15
        }));
      }
    }
  }, [highlightedId, establishments]);

  // Reset route state when selection changes
  useEffect(() => {
    if (selectedId) {
      setRouteInfo(undefined);
      setHasCenteredOnUser(true); // user is interacting with POIs
    }
    // Fit route once per selection/mode; avoid "jumping" the camera on every reroute tick.
    lastFitKeyRef.current = null;
  }, [selectedId]);

  // Center on the user's actual location the first time we get it (Home screen UX)
  useEffect(() => {
    if (!userLocation) return;
    if (hasCenteredOnUser) return;
    if (selectedId || highlightedId) return;

    setViewState(prev => ({
      ...prev,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      zoom: Math.max(prev.zoom, 14),
    }));
    setHasCenteredOnUser(true);
  }, [userLocation, hasCenteredOnUser, selectedId, highlightedId]);

  // Navigation mode: keep camera following the user (real-time)
  useEffect(() => {
    if (!followUser) return;
    if (!userLocation) return;
    // Throttle camera updates to keep the map smooth on mobile.
    // GPS can fire many times per second; updating React state that often is expensive.
    const now = Date.now();
    const last = lastFollowRef.current;
    const bearingFromSensor = userHeading ?? last?.bearing ?? 0;
    if (last) {
      const moved = haversineMeters({ lat: last.lat, lng: last.lng }, { lat: userLocation.lat, lng: userLocation.lng });
      const bearingDelta = Math.abs(((bearingFromSensor - last.bearing + 540) % 360) - 180);
      if (now - last.t < 250 && moved < 6 && bearingDelta < 10) return;
    }
    lastFollowRef.current = { t: now, lat: userLocation.lat, lng: userLocation.lng, bearing: bearingFromSensor };

    const userIsInteracting = now - lastUserGestureRef.current < 1500;

    setViewState((prev) => ({
      ...prev,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      // IMPORTANT: don't fight user zoom/tilt. In nav mode we only "lock" lat/lng.
      // Bearing is updated only when user isn't interacting (Glovo-like behavior).
      zoom: prev.zoom,
      bearing: userIsInteracting ? prev.bearing : bearingFromSensor,
      pitch: prev.pitch,
    }));
  }, [followUser, userLocation, userHeading]);

  // 3D buildings layer (re-added on style changes).
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const add3d = () => {
      try {
        // Some newer Mapbox styles enable globe+fog; on some bundles this can crash.
        // Force mercator projection + disable fog for stability (mobile-friendly).
        try {
          map.setProjection?.("mercator");
          map.setFog?.(null as any);
        } catch {
          // ignore
        }

        if (map.getLayer("3d-buildings")) return;
        const style = map.getStyle();
        if (!style?.sources || !(style.sources as any).composite) return;

        // Add below the first symbol layer (labels) if possible
        const layers = style.layers || [];
        const labelLayer = layers.find((l: any) => l.type === "symbol");
        const beforeId = labelLayer?.id;

        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": "#a7a7a7",
              "fill-extrusion-height": ["coalesce", ["get", "height"], 6],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.55,
            },
          } as any,
          beforeId,
        );
      } catch {
        // ignore (style not ready / layer exists / etc.)
      }
    };

    // Trigger once for initial load and again on style reloads.
    add3d();
    map.on("style.load", add3d);
    return () => {
      map.off("style.load", add3d);
    };
  }, []);

  const mapStyle = useMemo(() => {
    const isDark =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark");

    // In navigation mode, use Mapbox navigation styles (more "3D / driving" feel).
    if (followUser) {
      if (navMapStyle === "satellite") {
        // v11 tends to be more stable across bundlers than v12 (globe/fog).
        return "mapbox://styles/mapbox/satellite-streets-v11";
      }
      return isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";
    }

    return isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";
  }, [followUser, navMapStyle]);

  // When a route is available, fit the map to the route so the user can actually see it.
  useEffect(() => {
    if (followUser) return;
    if (!routeBounds) return;
    const map = mapRef.current;
    if (!map) return;
    const fitKey = `${selectedId ?? ""}:${routeMode}`;
    if (lastFitKeyRef.current === fitKey) return;

    try {
      map.fitBounds(routeBounds, {
        padding: 80,
        duration: 600,
      });
      lastFitKeyRef.current = fitKey;
    } catch {
      // ignore fitBounds errors (e.g. map not fully ready)
    }
  }, [routeBounds, followUser, selectedId, routeMode]);

  // Allow parent pages (e.g. /navigation) to display distance/duration and errors
  useEffect(() => {
    onRouteInfoChange?.(routeInfo);
  }, [routeInfo, onRouteInfoChange]);

  const handleRouteUpdate = useCallback((route: RouteInfo | null) => {
    setRouteInfo(route);
  }, []);

  // Precompute cumulative route distances when route changes (for progress puck).
  useEffect(() => {
    if (!routeInfo || !routeInfo.geometry || routeInfo.geometry.length < 2) {
      routeProgressRef.current = null;
      lastNearestIdxRef.current = 0;
      return;
    }
    const coords = routeInfo.geometry;
    const cum: number[] = [0];
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      total += haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
      cum.push(total);
    }
    routeProgressRef.current = { coords, cum, total: Math.max(total, 1) };
    lastNearestIdxRef.current = 0;
  }, [routeInfo]);

  const progressCoord = useMemo(() => {
    const pre = routeProgressRef.current;
    if (!pre) return null;
    const { coords, cum } = pre;
    if (coords.length < 2) return null;

    // Find nearest point on polyline (segment projection) with a small sliding window for speed.
    const p = { lat: userLoc.lat, lng: userLoc.lng };
    let bestIdx = Math.min(Math.max(lastNearestIdxRef.current, 0), coords.length - 2);
    let bestD = Infinity;
    let bestPoint: { lat: number; lng: number; t: number } | null = null;

    const scanWindow = 80;
    const start = Math.max(0, bestIdx - scanWindow);
    const end = Math.min(coords.length - 2, bestIdx + scanWindow);
    for (let i = start; i <= end; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const proj = projectToSegmentMeters(p, a, b);
      if (proj.dist < bestD) {
        bestD = proj.dist;
        bestIdx = i;
        bestPoint = proj;
      }
    }
    // Fallback full scan if we somehow lost the route (e.g. big jump).
    if (bestD > 250) {
      for (let i = 0; i < coords.length - 1; i += 3) {
        const a = coords[i];
        const b = coords[i + 1];
        const proj = projectToSegmentMeters(p, a, b);
        if (proj.dist < bestD) {
          bestD = proj.dist;
          bestIdx = i;
          bestPoint = proj;
        }
      }
    }

    lastNearestIdxRef.current = bestIdx;

    const bp = bestPoint ?? projectToSegmentMeters(p, coords[bestIdx], coords[bestIdx + 1]);
    const segStartMeters = cum[bestIdx] ?? 0;
    const segLenMeters = (cum[bestIdx + 1] ?? segStartMeters) - segStartMeters;
    const progressMeters = segStartMeters + Math.max(0, Math.min(1, bp.t)) * Math.max(1, segLenMeters);
    return { lat: bp.lat, lng: bp.lng, progressMeters };
  }, [userLoc.lat, userLoc.lng, routeInfo]);

  // Recenter requested by parent (navigation UI).
  useEffect(() => {
    if (!followUser) return;
    if (!userLocation) return;
    lastUserGestureRef.current = 0;
    setViewState((prev) => ({
      ...prev,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      zoom: Math.max(prev.zoom, routeMode === 'walking' ? 17.2 : routeMode === 'cycling' ? 16.9 : 16.5),
      bearing: userHeading ?? prev.bearing,
      pitch: Math.max(prev.pitch, routeMode === 'walking' ? 55 : routeMode === 'cycling' ? 58 : 60),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSeq, routeMode]);

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => {
          if (followUser) lastUserGestureRef.current = Date.now();
          setViewState(evt.viewState);
        }}
        onClick={(evt) => {
          const f = evt.features?.[0] as any;
          if (!f) {
            setSelectedId(null);
            return;
          }
          const props = (f.properties || {}) as any;
          const isCluster = props.cluster === true || props.cluster === "true";
          const map = mapRef.current?.getMap?.();
          if (!map) return;

          if (isCluster) {
            const clusterId = Number(props.cluster_id);
            const source: any = map.getSource("establishments");
            if (!source?.getClusterExpansionZoom) return;
            source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
              if (err) return;
              map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(18, zoom), duration: 450 });
            });
            return;
          }

          const id = props.id ? String(props.id) : null;
          if (id) {
            setSelectedId(id);
            setRouteInfo(undefined);
            setHasCenteredOnUser(true);
          }
        }}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
        interactive={interactive}
        dragPan={!followUser}
        reuseMaps
      >
        <GeolocateControl
          position="top-right"
          // We already manage geolocation in the app; tracking here duplicates updates and slows the map.
          trackUserLocation={false}
          showUserLocation={false}
          showAccuracyCircle={false}
          positionOptions={{
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }}
        />
        <NavigationControl position="top-right" showCompass={true} />

        {/* User Location Marker */}
        <Marker
          latitude={userLoc.lat}
          longitude={userLoc.lng}
          anchor="center"
        >
          <div className="relative">
            {/* Outer pulse */}
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0.15, 0.35] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-4 rounded-full bg-sky-400/35"
            />
            {/* White ring */}
            <div className="absolute -inset-2 rounded-full bg-white/90 shadow-lg" />
            {/* Blue dot */}
            <div className="relative h-4 w-4 rounded-full bg-sky-500 border-2 border-white shadow-md" />

            {/* Heading arrow (only when we have heading, mainly in navigation) */}
            {typeof userHeading === "number" && (
              <div
                className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2"
                style={{ transform: `translate(-50%, -50%) rotate(${userHeading}deg)` }}
              >
                <div
                  className="h-0 w-0"
                  style={{
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderBottom: "14px solid rgba(14,165,233,0.95)",
                    transform: "translateY(-20px)",
                    filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
                  }}
                />
              </div>
            )}
          </div>
        </Marker>

        {/* Establishments (clustered, fast) */}
        <Source
          id="establishments"
          type="geojson"
          data={establishmentsGeojson as any}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#2563eb",
              "circle-opacity": 0.85,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16,
                25,
                20,
                75,
                26,
                200,
                32,
              ],
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
              "text-size": 12,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "match",
                ["get", "category"],
                "maquis",
                "#f97316",
                "lounge",
                "#a855f7",
                "bar",
                "#3b82f6",
                "cave",
                "#10b981",
                "restaurant",
                "#fb7185",
                "hotel",
                "#64748b",
                "pharmacy",
                "#06b6d4",
                "police",
                "#f59e0b",
                "hospital",
                "#ef4444",
                "emergency",
                "#dc2626",
                "organizer",
                "#6366f1",
                "other",
                "#94a3b8",
                /* default */ "#3b82f6",
              ],
              "circle-radius": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                10,
                7,
              ],
              "circle-opacity": 0.95,
              "circle-stroke-width": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                3,
                2,
              ],
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>

        {/* Legend */}
        <div className="absolute bottom-24 left-4 z-10">
          {/* Desktop: always visible */}
          <div className="hidden sm:block">
            <div className="rounded-2xl bg-background/85 backdrop-blur-xl border border-border px-3 py-2 text-xs text-foreground space-y-1">
              <LegendRow color="bg-orange-500" label="Maquis" />
              <LegendRow color="bg-purple-500" label="Lounge" />
              <LegendRow color="bg-blue-500" label="Bar" />
              <LegendRow color="bg-emerald-500" label="Cave" />
              <LegendRow color="bg-rose-500" label="Restaurant" />
              <LegendRow color="bg-slate-500" label="Hôtel" />
              <LegendRow color="bg-cyan-500" label="Pharmacie" />
              <LegendRow color="bg-amber-500" label="Police" />
              <LegendRow color="bg-red-500" label="Hôpital / Clinique" />
              <LegendRow color="bg-red-600" label="Secours" />
              <LegendRow color="bg-indigo-500" label="Viganisateur" />
            </div>
          </div>

          {/* Mobile: compact toggle */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setLegendOpen((v) => !v)}
              className="rounded-full bg-background/85 backdrop-blur-xl border border-border px-3 py-2 text-xs font-semibold text-foreground shadow"
            >
              {legendOpen ? "Fermer" : "Légende"}
            </button>

            {legendOpen && (
              <div className="mt-2 rounded-2xl bg-background/90 backdrop-blur-xl border border-border px-3 py-2 text-xs text-foreground space-y-1 shadow">
                <LegendRow color="bg-orange-500" label="Maquis" />
                <LegendRow color="bg-purple-500" label="Lounge" />
                <LegendRow color="bg-blue-500" label="Bar" />
                <LegendRow color="bg-emerald-500" label="Cave" />
                <LegendRow color="bg-rose-500" label="Restaurant" />
                <LegendRow color="bg-slate-500" label="Hôtel" />
                <LegendRow color="bg-cyan-500" label="Pharmacie" />
                <LegendRow color="bg-amber-500" label="Police" />
                <LegendRow color="bg-red-500" label="Hôpital / Clinique" />
                <LegendRow color="bg-red-600" label="Secours" />
                <LegendRow color="bg-indigo-500" label="Viganisateur" />
              </div>
            )}
          </div>
        </div>

        {/* Route Layer - Only shows if enabled + establishment is selected */}
        {routeEnabled && selectedEstablishment && (
          <RouteLayer
            userLat={userLoc.lat}
            userLng={userLoc.lng}
            destLat={selectedEstablishment.coordinates.lat}
            destLng={selectedEstablishment.coordinates.lng}
            mode={routeMode}
            onRouteUpdate={handleRouteUpdate}
          />
        )}

        {/* Route progress puck (navigation feel) */}
        {followUser && progressCoord && (
          <Marker latitude={progressCoord.lat} longitude={progressCoord.lng} anchor="center">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0.12, 0.35] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -inset-3 rounded-full bg-white/35"
              />
              <div className="h-2.5 w-2.5 rounded-full bg-white shadow border border-white/70" />
            </div>
          </Marker>
        )}

        {/* Events markers */}
        {events.map((ev) => (
          <Marker
            key={ev.id}
            latitude={ev.establishment.coordinates.lat}
            longitude={ev.establishment.coordinates.lng}
            anchor="bottom"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground border-2 border-white shadow-lg flex items-center justify-center">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-white border border-primary" />
            </div>
          </Marker>
        ))}

        {/* Popup (hidden while navigation follow mode is active) */}
        {selectedEstablishment && !followUser && (
          <Popup
            latitude={selectedEstablishment.coordinates.lat}
            longitude={selectedEstablishment.coordinates.lng}
            anchor="top"
            onClose={() => setSelectedId(null)}
            closeButton={false}
            className="z-50"
          >
             <div 
               className="p-3 min-w-[220px] cursor-pointer"
               onClick={() => setLocation(`/details/${selectedEstablishment.id}`)}
             >
                <div className="mb-2 overflow-hidden rounded-lg border border-border">
                  <img
                    src={selectedEstablishment.imageUrl}
                    alt={selectedEstablishment.name}
                    className="h-24 w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h3 className="font-display font-bold text-lg text-slate-900">{selectedEstablishment.name}</h3>
                <p className="text-sm text-slate-600 capitalize mb-2">
                  {selectedEstablishment.category}
                  {selectedEstablishment.commune ? ` • ${selectedEstablishment.commune}` : ""}
                </p>

                <div className="bg-slate-50 rounded-lg p-2 mb-2 text-xs text-slate-700">
                  À {formatDistance(haversineMeters(userLoc, selectedEstablishment.coordinates))}
                </div>
                
                {routeInfo && (
                  <div className="bg-blue-50 rounded-lg p-2 mb-2 text-xs space-y-1">
                    <div className="flex justify-between text-blue-900 font-medium">
                      <span>{formatDistance(routeInfo.distance)}</span>
                      <span>{formatDuration(routeInfo.duration)}</span>
                    </div>
                  </div>
                )}

                {routeInfo === undefined && (
                  <div className="bg-slate-100 rounded-lg p-2 mb-2 text-xs text-slate-700">
                    Calcul de l’itinéraire…
                  </div>
                )}

                {routeInfo === null && (
                  <div className="bg-amber-50 rounded-lg p-2 mb-2 text-xs text-amber-900">
                    Itinéraire indisponible (GPS/téléphone, réseau ou Mapbox).
                  </div>
                )}

                {routeInfo && routeInfo.distance < 20 && (
                  <div className="bg-emerald-50 rounded-lg p-2 mb-2 text-xs text-emerald-900">
                    Vous êtes déjà sur place.
                  </div>
                )}
                
                <div className="mt-3 flex items-center text-primary font-medium text-sm">
                  <span>Voir itinéraire</span>
                  <Navigation className="w-3 h-3 ml-1" />
                </div>
             </div>
          </Popup>
        )}
      </Map>
      
      {/* Gradient Overlays */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background/80 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function CategoryIcon({ category }: { category: Establishment["category"] }) {
  const cls = "w-5 h-5 text-white";
  const Icon = getCategoryIcon(category);
  return <Icon className={cls} />;
}

// Project user point onto a polyline segment in meters using a local equirectangular approximation.
function projectToSegmentMeters(
  p: { lat: number; lng: number },
  a: [number, number],
  b: [number, number],
): { lat: number; lng: number; t: number; dist: number } {
  const lat0 = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const mx = (lng: number) => (lng * Math.PI / 180) * Math.cos(lat0) * 6371000;
  const my = (lat: number) => (lat * Math.PI / 180) * 6371000;

  const ax = mx(a[0]), ay = my(a[1]);
  const bx = mx(b[0]), by = my(b[1]);
  const px = mx(p.lng), py = my(p.lat);

  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  const tt = Math.max(0, Math.min(1, t));
  const cx = ax + abx * tt;
  const cy = ay + aby * tt;
  const dx = px - cx, dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Convert back to lat/lng (approx inverse of mx/my).
  const lng = (cx / (6371000 * Math.cos(lat0))) * (180 / Math.PI);
  const lat = (cy / 6371000) * (180 / Math.PI);
  return { lat, lng, t: tt, dist };
}
