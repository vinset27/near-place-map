/**
 * Écran Carte - Affichage principal avec Google Maps
 * Correspond à la page Home.tsx du projet web
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchEstablishmentsNearby, toUiEstablishment, submitBusinessApplication } from '../../services/establishments';
import { getCurrentLocation, watchLocation } from '../../services/location';
import { useLocationStore, useCurrentLocation } from '../../stores/useLocationStore';
import { ESTABLISHMENT_CATEGORIES } from '../../types/establishment';
import { haversineDistance } from '../../services/location';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { presignBusinessPhoto, uploadToPresignedPutUrl } from '../../services/businessPhotos';
import { BottomSheet } from '../../components/UI/BottomSheet';
import { EstablishmentCard } from '../../components/Cards/EstablishmentCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { setFavorite } from '../../services/favoritesApi';
import { OfflineBanner } from '../../components/UI/OfflineBanner';
import { demoEvents, getUpcomingEventsForEstablishments } from '../../services/events';
import { useStableQueryOrigin } from '../../services/queryOrigin';
import { getOnboardingIntent } from '../../services/onboarding';
import { getDiscoverLastQuery, getDiscoverPromptShown, setDiscoverLastQuery, setDiscoverPromptShown } from '../../services/discover';
import { fetchUserEventsNearby } from '../../services/userEventsApi';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { authMe } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import Constants from 'expo-constants';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Linking } from 'react-native';
import LottieView from 'lottie-react-native';
import { syncExpoPushTokenLocation } from '../../services/notifications';

const { height } = Dimensions.get('window');
const APP_LOGO = require('../../assets/icon.png');
const LOCATION_LOADER = require('../../assets/Location.json');

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

// Dark map theme (Google Maps style JSON). Keeps roads readable, removes glare.
const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
];

export default function MapScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const userLocation = useCurrentLocation();
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const stableOrigin = useStableQueryOrigin(userLocation);
  // IMPORTANT: use a stabilized origin for API queries to avoid refetching on every GPS tick.
  // Queries are already gated by `canQuery` so we won't fetch from DEFAULT_LOCATION when GPS is expected.
  const origin = stableOrigin;
  const { setUserLocation, setIsTracking, hasPermission } = useLocationStore();
  const insets = useSafeAreaInsets();
  const tabBarOffset = 62; // defined in (app)/_layout.tsx
  const favItems = useFavoritesStore((s) => s.items);
  const toggleFav = useFavoritesStore((s) => s.toggle);

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });

  // Keep backend updated with last known device location (for nearby notifications).
  useEffect(() => {
    const isAuthed = !!me;
    if (!isAuthed) return;
    if (!userLocation || !Number.isFinite(userLocation.lat) || !Number.isFinite(userLocation.lng)) return;
    void syncExpoPushTokenLocation({ lat: userLocation.lat, lng: userLocation.lng });
  }, [me, userLocation?.lat, userLocation?.lng]);
  const isEstablishment = !!me && (me as any)?.role === 'establishment' && !!(me as any)?.profileCompleted;
  const isAuthed = !!me;

  const toggleFavoriteGuarded = async (est: any) => {
    if (!isAuthed) {
      router.push('/login');
      return;
    }
    const id = String(est?.id || '').trim();
    if (!id) return;
    const was = !!favItems[id];
    const next = !was;
    // optimistic
    toggleFav(est);
    try {
      await setFavorite({ establishmentId: id, active: next });
    } catch {
      // revert if backend failed
      toggleFav(est);
    }
  };

  const [region, setRegion] = useState<Region>({
    latitude: userLocation.lat,
    longitude: userLocation.lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [is3d, setIs3d] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25 | 50 | 200>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedUserEventId, setSelectedUserEventId] = useState<string | null>(null);
  const [showUserEvents, setShowUserEvents] = useState(true);
  // Keep the map clean by default (user can open filters when needed).
  const [panelOpen, setPanelOpen] = useState(false);
  const mapType = useSettingsStore((s) => s.mapType);
  const setMapType = useSettingsStore((s) => s.setMapType);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<{
    name: string;
    category: string;
    phone: string;
    address: string;
    commune: string;
    description: string;
    lat: number;
    lng: number;
  }>(() => ({
    name: '',
    category: 'restaurant',
    phone: '',
    address: '',
    commune: '',
    description: '',
    lat: userLocation.lat,
    lng: userLocation.lng,
  }));
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [pickedPhotos, setPickedPhotos] = useState<Array<{ uri: string; fileName: string; mimeType: string }>>([]);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverQ, setDiscoverQ] = useState('');
  const [discoverReady, setDiscoverReady] = useState(false);

  // Démarrer le tracking GPS
  useEffect(() => {
    if (!hasPermission) return;

    let stopWatching: (() => void) | null = null;

    // Récupérer la position initiale
    getCurrentLocation().then((loc) => {
      setUserLocation(loc);
      setRegion({
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      // Ensure a 3D camera feel as soon as we have a real location (region prop would reset pitch).
      mapRef.current?.animateCamera(
        {
          center: { latitude: loc.lat, longitude: loc.lng },
          pitch: is3d ? 55 : 0,
          heading: 0,
          zoom: 15.5,
        },
        { duration: 600 },
      );
    });

    // Démarrer le suivi en temps réel
    watchLocation((loc) => setUserLocation(loc)).then((stop) => {
      stopWatching = stop;
    });

    setIsTracking(true);
    return () => {
      stopWatching?.();
      setIsTracking(false);
    };
  }, [hasPermission, setIsTracking, setUserLocation]);

  // Récupérer les établissements depuis l'API
  const canQuery = !hasPermission || !!rawUserLocation;

  const { data: establishments, isLoading, error } = useQuery({
    queryKey: ['establishments', origin.lat, origin.lng, radiusKm, selectedCategory, searchQuery],
    queryFn: async () => {
      const apiData = await fetchEstablishmentsNearby({
        lat: origin.lat,
        lng: origin.lng,
        radiusKm,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        q: searchQuery || undefined,
        // Avoid truncating results for larger radiuses (server supports up to 5000).
        limit: radiusKm >= 200 ? 5000 : radiusKm >= 50 ? 3500 : radiusKm >= 25 ? 2500 : 1200,
      });
      return apiData.map(toUiEstablishment);
    },
    enabled: canQuery,
    // Once loaded, don't refetch automatically. Only refetch when filters/origin key changes.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const { data: userEvents } = useQuery({
    queryKey: ['user-events', origin.lat, origin.lng, radiusKm],
    enabled: canQuery && showUserEvents,
    queryFn: () => fetchUserEventsNearby({ lat: origin.lat, lng: origin.lng, radiusKm, withinHours: 72, limit: 350 }),
    staleTime: 1000 * 60,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
  });

  // Filtrer les établissements affichés
  const filteredEstablishments = useMemo(() => {
    if (!establishments) return [];
    return establishments.filter((est) => {
      const distance = haversineDistance(origin, est.coordinates);
      if (distance > radiusKm * 1000) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const text = `${est.name} ${est.address} ${est.commune} ${est.category}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [establishments, radiusKm, searchQuery, origin]);

  const upcomingEvents = useMemo(() => getUpcomingEventsForEstablishments(filteredEstablishments), [filteredEstablishments]);

  // Reduce clutter: only render markers inside current viewport and cap count.
  const visibleEstablishments = useMemo(() => {
    if (!filteredEstablishments.length) return [];
    const latMin = region.latitude - region.latitudeDelta / 2;
    const latMax = region.latitude + region.latitudeDelta / 2;
    const lngMin = region.longitude - region.longitudeDelta / 2;
    const lngMax = region.longitude + region.longitudeDelta / 2;

    const inView = filteredEstablishments.filter((e) => {
      const lat = e.coordinates.lat;
      const lng = e.coordinates.lng;
      return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
    });

    // Sort by distance to the current stabilized origin
    const sorted = [...inView].sort((a, b) => haversineDistance(origin, a.coordinates) - haversineDistance(origin, b.coordinates));
    const MAX = 420;
    const sliced = sorted.slice(0, MAX);

    // Always keep selected marker visible (if present in filtered set)
    if (selectedMarker) {
      const sel = filteredEstablishments.find((x) => x.id === selectedMarker);
      if (sel && !sliced.some((x) => x.id === sel.id)) sliced.unshift(sel);
    }

    return sliced;
  }, [filteredEstablishments, origin, region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta, selectedMarker]);

  const suggestedEvents = useMemo(() => {
    const all = [...(userEvents || []), ...demoEvents];
    return getUpcomingEventsForEstablishments(filteredEstablishments, all as any, 48).slice(0, 5);
  }, [filteredEstablishments, userEvents]);

  // Découvrir: show prompt once (after onboarding) when we have a usable origin.
  useEffect(() => {
    if (!canQuery) return;
    if (discoverReady) return;
    let alive = true;
    (async () => {
      const shown = await getDiscoverPromptShown();
      if (!alive) return;
      if (shown) {
        setDiscoverReady(true);
        return;
      }
      const intent = await getOnboardingIntent();
      if (!alive) return;
      if (intent && intent.includes('discover')) {
        const last = await getDiscoverLastQuery();
        if (!alive) return;
        setDiscoverQ(last || '');
        setDiscoverOpen(true);
      }
      setDiscoverReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [canQuery, discoverReady]);

  const centerOnUser = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
    mapRef.current?.animateCamera(
      {
        center: { latitude: userLocation.lat, longitude: userLocation.lng },
        pitch: is3d ? 55 : 0,
        heading: 0,
        zoom: 15.5,
      },
      { duration: 500 },
    );
  };

  const selectedEstablishment = filteredEstablishments.find((e) => e.id === selectedMarker);
  const selectedUserEvent = (userEvents || []).find((e: any) => String(e?.id) === String(selectedUserEventId));

  const visibleUserEvents = useMemo(() => {
    const items = Array.isArray(userEvents) ? userEvents : [];
    if (!items.length) return [];
    const latMin = region.latitude - region.latitudeDelta / 2;
    const latMax = region.latitude + region.latitudeDelta / 2;
    const lngMin = region.longitude - region.longitudeDelta / 2;
    const lngMax = region.longitude + region.longitudeDelta / 2;
    const inView = items.filter((e: any) => {
      const lat = Number(e?.lat);
      const lng = Number(e?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
    });
    // keep it reasonable
    return inView.slice(0, 160);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta, userEvents]);

  const getCategoryColor = (category: string): string => {
    const cat = ESTABLISHMENT_CATEGORIES.find((c) => c.id === category);
    return cat?.color || '#3b82f6';
  };

  // IMPORTANT:
  // - customMapStyle only works on Google Maps provider
  // - On iOS in Expo Go, react-native-maps often uses Apple Maps => styles won't apply.
  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useGoogleProvider = Platform.OS === 'android' || (Platform.OS === 'ios' && !isExpoGo);
  const isSatellite = mapType === 'satellite';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {isLoading && (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <View style={[styles.loaderCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <LottieView source={LOCATION_LOADER} autoPlay loop style={{ width: 120, height: 120 }} />
            <Text style={{ color: t.text, fontWeight: '950', marginTop: 6 }}>Chargement…</Text>
            <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }}>Lieux proches de vous</Text>
          </View>
        </View>
      )}
      <MapView
        ref={mapRef}
        provider={useGoogleProvider ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        mapType={mapType as any}
        customMapStyle={useGoogleProvider && t.isDark && !isSatellite ? DARK_MAP_STYLE : undefined}
        onPress={() => {
          if (!panelOpen) return;
          setPanelOpen(false);
          Keyboard.dismiss();
        }}
        showsUserLocation={hasPermission}
        showsMyLocationButton={false}
        showsCompass
        toolbarEnabled={false}
        pitchEnabled
        rotateEnabled
        showsBuildings
        // A bit of 3D feel by default
        initialCamera={{
          center: { latitude: region.latitude, longitude: region.longitude },
          pitch: 45,
          heading: 0,
          zoom: 15,
          altitude: 0,
        }}
        onLongPress={(e) => {
          if (!addOpen) return;
          const c = e.nativeEvent.coordinate;
          setDraft((d) => ({ ...d, lat: c.latitude, lng: c.longitude }));
        }}
        // Google Maps POIs (Android): allow itinerary even for places not in our DB.
        // @ts-ignore - onPoiClick exists on Google provider but may not be in typings.
        onPoiClick={(e: any) => {
          try {
            const c = e?.nativeEvent?.coordinate;
            const name = String(e?.nativeEvent?.name || 'Destination');
            if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
            setSelectedMarker(null);
            setSelectedUserEventId(null);
            setPanelOpen(false);
            Keyboard.dismiss();
            router.push({
              pathname: '/navigation',
              params: {
                mode: 'driving',
                lat: String(c.latitude),
                lng: String(c.longitude),
                name,
                category: 'other',
              },
            } as any);
          } catch {}
        }}
      >
        {/* User events (meetups/parties) */}
        {showUserEvents &&
          visibleUserEvents.map((ev: any) => (
            <Marker
              key={`ue-${String(ev.id)}`}
              coordinate={{ latitude: Number(ev.lat), longitude: Number(ev.lng) }}
              onPress={() => {
                setSelectedUserEventId(String(ev.id));
                setSelectedMarker(null);
                setPanelOpen(false);
                Keyboard.dismiss();
              }}
              pinColor={String(ev.kind) === 'meet' ? '#22c55e' : '#ef4444'}
            />
          ))}
        {visibleEstablishments.map((establishment) => (
          <Marker
            key={establishment.id}
            coordinate={{
              latitude: establishment.coordinates.lat,
              longitude: establishment.coordinates.lng,
            }}
            onPress={() => {
              setSelectedMarker(establishment.id);
              setSelectedUserEventId(null);
              setPanelOpen(false);
              Keyboard.dismiss();
            }}
            pinColor={getCategoryColor(establishment.category)}
          />
        ))}

        {/* Draft marker for "Add place" */}
        {addOpen && (
          <Marker
            coordinate={{ latitude: draft.lat, longitude: draft.lng }}
            title="Nouvel établissement"
            description="Appuie long sur la carte pour déplacer"
            pinColor="#111827"
          />
        )}
      </MapView>

      <View style={[styles.topOverlay, { top: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: panelOpen ? 10 : 0 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setMapType(isSatellite ? 'standard' : 'satellite')}
            style={[styles.panelToggle, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <Image source={APP_LOGO} style={styles.toggleLogo} />
            <Text style={[styles.panelToggleText, { color: t.text, transform: [{ scale: t.textScale }] }]}>
              {isSatellite ? 'Roadmap' : 'Satellite'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setPanelOpen((v) => !v)}
            style={[styles.panelToggle, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <Text style={[styles.panelToggleText, { color: t.text, transform: [{ scale: t.textScale }] }]}>
              {panelOpen ? 'Masquer' : 'Filtres'}
            </Text>
          </TouchableOpacity>
        </View>

        {panelOpen && (
          <View style={[styles.panel, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <OfflineBanner />
          </View>
          <View style={{ gap: 10 }}>
            <View style={[styles.searchBar, { backgroundColor: t.input, borderColor: t.border }]}>
              <Text style={[styles.searchIcon, { color: t.muted }]}>⌕</Text>
              <TextInput
                style={[styles.searchInput, { color: t.text, transform: [{ scale: t.textScale }] }]}
                placeholder="Rechercher un lieu, une rue…"
                placeholderTextColor={t.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {!!searchQuery.trim() && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    Keyboard.dismiss();
                  }}
                  style={[styles.searchClearBtn, { backgroundColor: t.card, borderColor: t.border }]}
                  hitSlop={10}
                >
                  <Text style={[styles.searchClearText, { color: t.muted }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.radiusSelector, { backgroundColor: t.input, borderColor: t.border }]}>
              {[5, 10, 25, 50, 200].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusButton, radiusKm === r && [styles.radiusButtonActive, { backgroundColor: t.primary }]]}
                  onPress={() => setRadiusKm(r as any)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.radiusButtonText, { color: t.muted, transform: [{ scale: t.textScale }] }, radiusKm === r && styles.radiusButtonTextActive]}>
                    {r === 200 ? 'CI' : `${r}km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.categoriesScroll, { marginBottom: 0 }]} contentContainerStyle={styles.categoriesContent}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { backgroundColor: t.input, borderColor: t.border },
                selectedCategory === 'all' && [styles.categoryChipActive, { backgroundColor: t.primary, borderColor: t.primary }],
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: t.muted, transform: [{ scale: t.textScale }] },
                  selectedCategory === 'all' && styles.categoryChipTextActive,
                ]}
              >
                Tous
              </Text>
            </TouchableOpacity>

            {ESTABLISHMENT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: t.input, borderColor: t.border },
                  selectedCategory === cat.id && [styles.categoryChipActive, { backgroundColor: t.primary, borderColor: t.primary }],
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.categoryChipText, { color: t.muted, transform: [{ scale: t.textScale }] }, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {(hasPermission && !rawUserLocation) || !hasPermission || upcomingEvents.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {hasPermission && !rawUserLocation && (
                <View style={[styles.gpsPill, { backgroundColor: t.input, borderColor: t.border, marginBottom: 0 }]}>
                  <Text style={[styles.gpsPillText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Recherche de votre position…</Text>
                </View>
              )}
              {!hasPermission && (
                <View style={[styles.gpsPill, { backgroundColor: t.input, borderColor: t.border, marginBottom: 0 }]}>
                  <Text style={[styles.gpsPillText, { color: t.text, transform: [{ scale: t.textScale }] }]}>GPS non activé</Text>
                </View>
              )}
              {upcomingEvents.length > 0 && (
                <TouchableOpacity activeOpacity={0.9} style={[styles.eventsPill, { marginBottom: 0 }]} onPress={() => router.push('/events' as any)}>
                  <Text style={styles.eventsPillText}>
                    {upcomingEvents.length} événement{upcomingEvents.length > 1 ? 's' : ''} près d’ici
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: t.muted, fontWeight: '900' }}>Soirées users</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowUserEvents((v) => !v)}
              style={[styles.smallToggle, { backgroundColor: t.input, borderColor: t.border }]}
            >
              <Text style={{ color: t.text, fontWeight: '900' }}>{showUserEvents ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.myLocationButton, { backgroundColor: t.card, borderColor: t.border }]} onPress={centerOnUser}>
        <Text style={styles.myLocationIcon}>📍</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.myLocationButton, { top: 140, backgroundColor: t.card, borderColor: t.border }]}
        onPress={() => {
          const next = !is3d;
          setIs3d(next);
          mapRef.current?.animateCamera(
            {
              center: { latitude: userLocation.lat, longitude: userLocation.lng },
              pitch: next ? 55 : 0,
              heading: 0,
              zoom: next ? 15.5 : 14.8,
            },
            { duration: 520 },
          );
        }}
      >
        <Text style={styles.myLocationIcon}>{is3d ? '3D' : '2D'}</Text>
      </TouchableOpacity>

      {discoverOpen && (
        <BottomSheet
          snapPoints={[190, 520]}
          initialSnapIndex={1}
          backdrop
          bottomOffset={tabBarOffset + insets.bottom}
          backgroundColor={t.isDark ? '#0b1220' : t.card}
        >
          <View style={styles.discoverHeader}>
            <Text style={styles.discoverTitle}>Qu’est-ce que vous cherchez précisément ?</Text>
            <TouchableOpacity
              onPress={async () => {
                await setDiscoverPromptShown(true);
                setDiscoverOpen(false);
              }}
              style={styles.discoverClose}
            >
              <Text style={styles.discoverCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.discoverInputRow}>
            <Text style={styles.discoverIcon}>🔎</Text>
            <TextInput
              value={discoverQ}
              onChangeText={setDiscoverQ}
              placeholder="Ex: restaurant, lounge, pharmacie..."
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.discoverInput}
            />
          </View>

          <View style={styles.discoverChips}>
            {[
              { id: 'restaurant', label: 'Restaurant' },
              { id: 'lounge', label: 'Lounge' },
              { id: 'bar', label: 'Bar' },
              { id: 'maquis', label: 'Maquis' },
              { id: 'pharmacy', label: 'Pharmacie' },
            ].map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.discoverChip}
                onPress={() => {
                  setSelectedCategory(c.id);
                  setSearchQuery('');
                  setDiscoverQ('');
                }}
              >
                <Text style={styles.discoverChipText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.discoverActions}>
            <TouchableOpacity
              style={styles.discoverPrimary}
              onPress={async () => {
                const q = String(discoverQ || '').trim();
                setSearchQuery(q);
                await setDiscoverLastQuery(q);
                await setDiscoverPromptShown(true);
                setDiscoverOpen(false);
              }}
            >
              <Text style={styles.discoverPrimaryText}>Explorer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.discoverGhost}
              onPress={async () => {
                await setDiscoverPromptShown(true);
                setDiscoverOpen(false);
                router.push('/events' as any);
              }}
            >
              <Text style={styles.discoverGhostText}>Voir les évènements</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={styles.discoverSectionTitle}>Évènements près de vous</Text>
            {suggestedEvents.length === 0 ? (
              <Text style={styles.discoverEmpty}>Aucun évènement trouvé pour l’instant.</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {suggestedEvents.slice(0, 4).map((ev: any) => {
                  const est = ev.establishment;
                  const cover = (est?.photos && est.photos.length ? est.photos[0] : null) || est?.imageUrl || null;
                  return (
                    <TouchableOpacity
                      key={String(ev.id)}
                      activeOpacity={0.9}
                      onPress={async () => {
                        await setDiscoverPromptShown(true);
                        setDiscoverOpen(false);
                        router.push('/events' as any);
                      }}
                      style={styles.discoverEventRow}
                    >
                      <PlaceImage
                        uri={cover}
                        id={`${String(ev.id)}-d`}
                        name={String(ev.title)}
                        category={est?.category}
                        style={styles.discoverEventImg}
                        textSize={18}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.discoverEventTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.discoverEventMeta} numberOfLines={1}>
                          {est?.name || 'Organisateur'} • {new Date(ev.startsAt).toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </BottomSheet>
      )}

      {/* Add place button */}
      {isEstablishment && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setCreateError(null);
            setDraft((d) => ({
              ...d,
              lat: userLocation.lat,
              lng: userLocation.lng,
            }));
            setAddOpen(true);
          }}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      )}

      {selectedEstablishment && (
        <BottomSheet
          snapPoints={[110, 230, Math.min(520, Math.max(380, Math.round(height * 0.55)))]}
          initialSnapIndex={1}
          backdrop={false}
          backgroundColor={t.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.96)'}
          contentStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
          bottomOffset={tabBarOffset + insets.bottom}
        >
          <View style={{ paddingTop: 6 }}>
            <EstablishmentCard
              item={{
                ...selectedEstablishment,
                distanceMeters: haversineDistance(origin, selectedEstablishment.coordinates),
              }}
              variant="map"
              onPress={() => router.push(`/establishment/${selectedEstablishment.id}`)}
              onClose={() => setSelectedMarker(null)}
              favorite={{
                active: !!favItems[selectedEstablishment.id],
                onToggle: () => void toggleFavoriteGuarded(selectedEstablishment),
              }}
            />

            <View style={styles.mapCtas}>
              <TouchableOpacity style={styles.mapCtaGhost} onPress={() => router.push(`/establishment/${selectedEstablishment.id}`)}>
                <Text style={styles.mapCtaGhostText}>Détails</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapCtaPrimary}
                onPress={() =>
                  router.push({
                    pathname: '/navigation',
                    params: {
                      id: selectedEstablishment.id,
                      mode: 'driving',
                      lat: String(selectedEstablishment.coordinates.lat),
                      lng: String(selectedEstablishment.coordinates.lng),
                      name: selectedEstablishment.name,
                      category: selectedEstablishment.category,
                      address: selectedEstablishment.address || '',
                      commune: selectedEstablishment.commune || '',
                      cover: selectedEstablishment.imageUrl || '',
                    },
                  } as any)
                }
              >
                <Text style={styles.mapCtaPrimaryText}>Itinéraire</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      {selectedUserEvent && (
        <BottomSheet
          snapPoints={[120, 260]}
          initialSnapIndex={1}
          backdrop={false}
          backgroundColor={t.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.96)'}
          contentStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
          bottomOffset={tabBarOffset + insets.bottom}
        >
          <View style={{ paddingTop: 6 }}>
            <Text style={{ color: t.text, fontWeight: '950', fontSize: 16 }} numberOfLines={2}>
              {String((selectedUserEvent as any)?.title || 'Soirée')}
            </Text>
            <Text style={{ marginTop: 6, color: t.muted, fontWeight: '800' }} numberOfLines={2}>
              {(selectedUserEvent as any)?.organizer?.name ? `Par ${(selectedUserEvent as any).organizer.name} • ` : ''}
              {new Date((selectedUserEvent as any).startsAt).toLocaleString()}
            </Text>
            <View style={styles.mapCtas}>
              <TouchableOpacity
                style={[styles.mapCtaGhost, { backgroundColor: t.input, borderColor: t.border }]}
                onPress={() => setSelectedUserEventId(null)}
              >
                <Text style={[styles.mapCtaGhostText, { color: t.text }]}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapCtaPrimary, { backgroundColor: t.primary }]}
                onPress={() => {
                  const lat = Number((selectedUserEvent as any).lat);
                  const lng = Number((selectedUserEvent as any).lng);
                  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                  Linking.openURL(url).catch(() => {});
                }}
              >
                <Text style={[styles.mapCtaPrimaryText, { color: '#fff' }]}>Ouvrir Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement des lieux...</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Chargement impossible</Text>
          <Text style={styles.errorText}>
            Le backend met trop de temps à répondre (cold start / indisponible). Attends 20-30s et réessaie.
          </Text>
          <Text style={styles.errorTextSmall}>{String((error as any)?.message || error)}</Text>
        </View>
      )}

      <View style={[styles.counterBadge, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.counterText, { color: t.text, transform: [{ scale: t.textScale }] }]}>
          {filteredEstablishments.length} lieu{filteredEstablishments.length > 1 ? 'x' : ''}
        </Text>
      </View>

      {/* Add place modal */}
      <Modal visible={addOpen && isEstablishment} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un lieu</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setAddOpen(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              Ta demande sera envoyée à l’admin pour validation. Astuce: appuie long sur la carte pour positionner précisément le marqueur.
            </Text>

            <View style={styles.formRow}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="Ex: Chez Tante Awa"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.label}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 6 }}>
                {ESTABLISHMENT_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, draft.category === c.id && styles.chipActive]}
                    onPress={() => setDraft((d) => ({ ...d, category: c.id }))}
                  >
                    <Text style={[styles.chipText, draft.category === c.id && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Photos (optionnel)</Text>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={async () => {
                    setCreateError(null);
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (perm.status !== 'granted') {
                      setCreateError("Permission photos refusée.");
                      return;
                    }
                    const res = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsMultipleSelection: true,
                      selectionLimit: 6,
                      quality: 0.85,
                    });
                    if (res.canceled) return;
                    const next = (res.assets || [])
                      .filter((a) => !!a.uri)
                      .map((a) => ({
                        uri: a.uri,
                        fileName: a.fileName || `photo-${Date.now()}.jpg`,
                        mimeType: a.mimeType || 'image/jpeg',
                      }));
                    setPickedPhotos(next);
                  }}
                >
                  <Text style={styles.smallBtnText}>Choisir</Text>
                </TouchableOpacity>
              </View>

              {pickedPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 6 }}>
                  {pickedPhotos.map((p) => (
                    <Image key={p.uri} source={{ uri: p.uri }} style={styles.thumb} />
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.formRow}>
              <Text style={styles.label}>Téléphone (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={draft.phone}
                onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))}
                placeholder="+225 ..."
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.label}>Adresse (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={draft.address}
                onChangeText={(v) => setDraft((d) => ({ ...d, address: v }))}
                placeholder="Rue / quartier"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={styles.label}>Commune (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={draft.commune}
                onChangeText={(v) => setDraft((d) => ({ ...d, commune: v }))}
                placeholder="Cocody, Marcory…"
              />
            </View>

            {!!createError && (
              <View style={styles.createError}>
                <Text style={styles.createErrorTitle}>Impossible d’enregistrer</Text>
                <Text style={styles.createErrorText}>{createError}</Text>
              </View>
            )}
            {!!submittedId && (
              <View style={styles.createOk}>
                <Text style={styles.createOkTitle}>Demande envoyée</Text>
                <Text style={styles.createOkText}>
                  Référence: {submittedId}. Elle apparaîtra sur la carte après validation.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.createBtn, createLoading && { opacity: 0.7 }]}
              disabled={createLoading}
              onPress={async () => {
                setCreateError(null);
                setSubmittedId(null);
                if (!draft.name.trim()) {
                  setCreateError('Le nom est requis.');
                  return;
                }
                setCreateLoading(true);
                try {
                  // Upload photos to R2 (presign + PUT), then send public URLs
                  const uploadedUrls: string[] = [];
                  for (const p of pickedPhotos) {
                    const presign = await presignBusinessPhoto({
                      fileName: p.fileName,
                      contentType: p.mimeType,
                    });
                    await uploadToPresignedPutUrl({
                      putUrl: presign.putUrl,
                      localUri: p.uri,
                      contentType: p.mimeType,
                    });
                    uploadedUrls.push(presign.publicUrl);
                  }

                  const res = await submitBusinessApplication({
                    name: draft.name.trim(),
                    category: draft.category,
                    phone: draft.phone.trim() || 'N/A',
                    address: draft.address.trim() || undefined,
                    commune: draft.commune.trim() || undefined,
                    description: draft.description.trim() || undefined,
                    photos: uploadedUrls.length > 0 ? uploadedUrls : undefined,
                    lat: draft.lat,
                    lng: draft.lng,
                  });
                  setSubmittedId(res.id);
                  // No map refresh needed: it will appear only after admin approval (like web).
                } catch (e: any) {
                  setCreateError(String(e?.response?.data?.message || e?.message || 'Erreur réseau'));
                } finally {
                  setCreateLoading(false);
                }
              }}
            >
              {createLoading ? <ActivityIndicator color="#0b2a6b" /> : <Text style={styles.createBtnText}>Envoyer la demande</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  loaderCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  topOverlay: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16 },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  panelToggle: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelToggleText: { fontWeight: '900', fontSize: 12 },
  toggleLogo: { width: 16, height: 16, borderRadius: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchIcon: { fontWeight: '900', fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '800' },
  searchClearBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { fontWeight: '900', fontSize: 12 },
  categoriesScroll: { marginBottom: 12 },
  categoriesContent: { paddingRight: 16 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryChipActive: {},
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryChipText: { fontSize: 12, fontWeight: '900' },
  categoryChipTextActive: { color: '#ffffff' },
  radiusSelector: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
  },
  radiusButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  radiusButtonActive: {},
  radiusButtonText: { fontSize: 12, fontWeight: '900' },
  radiusButtonTextActive: { color: '#ffffff' },
  smallToggle: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  myLocationButton: {
    position: 'absolute',
    bottom: 160,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  myLocationIcon: { fontSize: 24 },
  addButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0b1220',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addButtonText: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: -2 },
  detailCard: {
    // legacy (replaced by BottomSheet)
  },
  detailCardContent: { flexDirection: 'row', alignItems: 'center' },
  detailCardLeft: { flex: 1, marginRight: 12 },
  detailCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  detailCardSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  detailCardDistance: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  detailCardButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  detailCardButtonText: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },
  closeDetailButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeDetailButtonText: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  mapCtas: { flexDirection: 'row', gap: 10, marginTop: 10, paddingHorizontal: 2 },
  mapCtaGhost: {
    flex: 1,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.18)',
  },
  mapCtaGhostText: { color: '#2563eb', fontWeight: '900' },
  mapCtaPrimary: { flex: 1, backgroundColor: '#0b1220', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  mapCtaPrimaryText: { color: '#fff', fontWeight: '900' },
  loadingOverlay: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#475569', fontWeight: '600' },
  errorOverlay: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  errorTitle: { color: '#0b1220', fontWeight: '900', marginBottom: 4 },
  errorText: { color: '#0b1220', fontSize: 12, lineHeight: 16 },
  errorTextSmall: { color: '#0b1220', fontSize: 11, marginTop: 6, opacity: 0.75 },
  counterBadge: {
    position: 'absolute',
    top: height - 60,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterText: { fontSize: 12, fontWeight: '800' },
  eventsPill: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  gpsPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  gpsPillText: { color: '#0b1220', fontWeight: '900', fontSize: 12 },

  discoverHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  discoverTitle: { color: '#fff', fontWeight: '950', fontSize: 16, flex: 1, lineHeight: 20 },
  discoverClose: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  discoverCloseText: { color: 'rgba(255,255,255,0.92)', fontWeight: '900', fontSize: 14 },
  discoverInputRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12 },
  discoverIcon: { color: 'rgba(255,255,255,0.85)' },
  discoverInput: { flex: 1, color: '#fff', fontWeight: '800' },
  discoverChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  discoverChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  discoverChipText: { color: 'rgba(255,255,255,0.88)', fontWeight: '900', fontSize: 12 },
  discoverActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  discoverPrimary: { flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  discoverPrimaryText: { color: '#0b1220', fontWeight: '950' },
  discoverGhost: { flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 14, alignItems: 'center' },
  discoverGhostText: { color: '#fff', fontWeight: '950' },
  discoverSectionTitle: { color: 'rgba(255,255,255,0.90)', fontWeight: '950', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  discoverEmpty: { marginTop: 10, color: 'rgba(255,255,255,0.70)', fontWeight: '700' },
  discoverEventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  discoverEventImg: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)' },
  discoverEventTitle: { color: '#fff', fontWeight: '950' },
  discoverEventMeta: { marginTop: 4, color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 12 },
  eventsPillText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0b1220' },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#0b1220', fontWeight: '900' },
  modalHint: { color: '#64748b', fontSize: 12, lineHeight: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  smallBtnText: { color: '#0b1220', fontWeight: '900', fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#e2e8f0', marginRight: 8 },
  formRow: { gap: 6 },
  label: { color: '#0b1220', fontWeight: '800', fontSize: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#0b1220' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  createBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  createBtnText: { color: '#0b2a6b', fontWeight: '900' },
  createError: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', borderWidth: 1, borderRadius: 12, padding: 10 },
  createErrorTitle: { color: '#991b1b', fontWeight: '900', marginBottom: 2 },
  createErrorText: { color: '#991b1b', opacity: 0.9, fontSize: 12 },
  createOk: { backgroundColor: 'rgba(34, 197, 94, 0.10)', borderColor: 'rgba(34, 197, 94, 0.30)', borderWidth: 1, borderRadius: 12, padding: 10 },
  createOkTitle: { color: '#065f46', fontWeight: '900', marginBottom: 2 },
  createOkText: { color: '#065f46', opacity: 0.9, fontSize: 12 },
});



