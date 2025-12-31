/**
 * Écran Détails d'un établissement
 * Correspond à la page Details.tsx du projet web
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Share,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEstablishmentById, toUiEstablishment } from '../../services/establishments';
import { useCurrentLocation } from '../../stores/useLocationStore';
import { haversineDistance, formatDistance } from '../../services/location';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { fetchGooglePlaceDetails } from '../../services/googlePlaceDetails';
import { getPlaceFallbackImage } from '../../services/placeFallbackImage';
import { trackEstablishmentView } from '../../services/analytics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAppTheme } from '../../services/settingsTheme';
import Constants from 'expo-constants';
import { Platform as RNPlatform } from 'react-native';

const { width } = Dimensions.get('window');
const GIF_WALK = require('../../assets/walk.gif');
const GIF_CAR = require('../../assets/voiture.gif');
const GIF_BIKE = require('../../assets/velo.gif');

export default function EstablishmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const userLocation = useCurrentLocation();
  const t = useAppTheme();
  const defaultTravelMode = useSettingsStore((s) => s.defaultTravelMode);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'bicycling'>(defaultTravelMode);
  useEffect(() => {
    setTravelMode(defaultTravelMode);
  }, [defaultTravelMode]);
  const favItems = useFavoritesStore((s) => s.items);
  const toggleFav = useFavoritesStore((s) => s.toggle);

  const cachedFromLists = useMemo(() => {
    if (!id) return null;
    const keys: any[] = [['establishments'], ['list-establishments'], ['events-establishments']];
    for (const k of keys) {
      const all = qc.getQueriesData({ queryKey: k });
      for (const [, value] of all) {
        const arr = Array.isArray(value) ? value : (value as any)?.establishments || value;
        if (!Array.isArray(arr)) continue;
        const found = arr.find((e: any) => String(e?.id) === String(id));
        if (found) return found;
      }
    }
    return null;
  }, [id, qc]);

  const initialEstablishment = useMemo(() => {
    if (!cachedFromLists) return undefined;
    // IMPORTANT: list/map store UI Establishment objects (already converted).
    // Only convert if it looks like an API row (has lat/lng and no coordinates).
    const looksUi = typeof (cachedFromLists as any)?.coordinates?.lat === 'number';
    if (looksUi) return cachedFromLists as any;
    return toUiEstablishment(cachedFromLists as any);
  }, [cachedFromLists]);

  // Récupérer les détails de l'établissement
  const { data: establishment, isLoading, error } = useQuery({
    queryKey: ['establishment', id],
    queryFn: async () => {
      if (!id) throw new Error('ID manquant');
      const data = await fetchEstablishmentById(id);
      if (!data) throw new Error('Établissement non trouvé');
      return toUiEstablishment(data);
    },
    enabled: !!id,
    initialData: initialEstablishment,
    staleTime: 1000 * 60 * 10,
    retry: 1,
    retryDelay: (attempt) => Math.min(2000 * Math.pow(2, attempt), 8000),
  });

  // Analytics: count views (fire-and-forget, ignore failures)
  useEffect(() => {
    const estId = String(id || '').trim();
    if (!estId) return;
    let alive = true;
    (async () => {
      try {
        await trackEstablishmentView({ establishmentId: estId, source: 'details' });
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const placeId =
    (establishment as any)?.providerPlaceId ??
    (establishment as any)?.provider_place_id ??
    null;

  const { data: googleDetails } = useQuery({
    queryKey: ['google-place', placeId],
    enabled: !!placeId && (establishment?.provider === 'google' || establishment?.provider === 'google_places'),
    queryFn: async () => fetchGooglePlaceDetails({ placeId: String(placeId) }),
    staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    retry: 1,
    retryDelay: (attempt) => Math.min(1500 * Math.pow(2, attempt), 6000),
  });

  // IMPORTANT: all hooks must run before any conditional return (Rules of Hooks).
  const distance = useMemo(() => {
    if (!establishment) return 0;
    return haversineDistance(userLocation, establishment.coordinates);
  }, [establishment, userLocation]);

  const displayPhotos = useMemo(() => {
    if (!establishment) return [];
    const a = Array.isArray(establishment.photos) ? establishment.photos : [];
    const b = Array.isArray((googleDetails as any)?.photoUrls) ? (googleDetails as any).photoUrls : [];
    const chosen = a.length > 0 ? a : b;
    return chosen.filter((p: any) => typeof p === 'string' && String(p).trim().length > 0);
  }, [establishment, googleDetails]);

  const photoFallback = useMemo(() => getPlaceFallbackImage(establishment?.category || 'restaurant'), [establishment?.category]);
  const openNow = googleDetails?.openNow;

  if (isLoading && !establishment) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.loadingText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Chargement...</Text>
      </View>
    );
  }

  if (!establishment) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={[styles.errorText, { color: t.text, transform: [{ scale: t.textScale }] }]}>
            {error ? 'Chargement impossible' : 'Établissement non trouvé'}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Fonctions d'action
  const handleCall = () => {
    if (establishment.phone) {
      Linking.openURL(`tel:${establishment.phone}`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvrez ${establishment.name} sur O'Show !\n\n${establishment.address}, ${establishment.commune}\n\nhttps://maps.google.com/?q=${establishment.coordinates.lat},${establishment.coordinates.lng}`,
        title: establishment.name,
      });
    } catch (error) {
      console.error('Erreur lors du partage:', error);
    }
  };

  const handleNavigate = () => {
    // In-app navigation (preferred)
    router.push({ pathname: '/navigation', params: { id: establishment.id, mode: travelMode } } as any);
  };

  const handleOpenMaps = () => {
    // Ouvrir directement la position dans Google Maps
    const url = `https://www.google.com/maps/search/?api=1&query=${establishment.coordinates.lat},${establishment.coordinates.lng}`;
    Linking.openURL(url);
  };

  const isExpoGo = (Constants as any)?.appOwnership === 'expo';
  const useSatellitePreview = t.isDark; // requirement: show satellite preview when app is in dark mode
  const previewMapType = useSatellitePreview ? 'satellite' : 'standard';
  const canForceGoogleProvider = RNPlatform.OS === 'android' || (RNPlatform.OS === 'ios' && !isExpoGo);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: t.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={styles.netWarn}>
            <Text style={[styles.netWarnTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Réseau instable</Text>
            <Text style={[styles.netWarnText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>
              Affichage depuis le cache. Certaines infos peuvent mettre du temps à se mettre à jour.
            </Text>
          </View>
        )}
        {/* Image principale */}
        <View style={styles.heroContainer}>
          <PlaceImage
            uri={displayPhotos[0] || establishment.imageUrl || null}
            fallbackSource={photoFallback}
            id={establishment.id}
            name={establishment.name}
            category={establishment.category}
            style={styles.heroImage}
            textSize={72}
          />
          <View style={styles.heroGradient} />

          {/* Boutons header */}
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Text style={styles.headerButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={() => toggleFav(establishment)}>
                <Text style={[styles.headerButtonIcon, !!favItems[establishment.id] && { color: '#ef4444' }]}>
                  {!!favItems[establishment.id] ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
                <Text style={styles.headerButtonIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Infos superposées */}
          <View style={styles.heroOverlay}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{establishment.category}</Text>
            </View>
            {establishment.isOpen ? (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {typeof openNow === 'boolean' ? (openNow ? 'Ouvert maintenant' : 'Fermé') : 'Statut inconnu'}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, styles.statusBadgeClosed]}>
                <Text style={styles.statusTextClosed}>Fermé</Text>
              </View>
            )}
          </View>
        </View>

        {/* Contenu principal */}
        <View style={styles.content}>
          {/* Titre et rating */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]}>{establishment.name}</Text>
            <View style={styles.ratingContainer}>
              <Text style={[styles.ratingText, { color: t.text, transform: [{ scale: t.textScale }] }]}>⭐ {establishment.rating}</Text>
              <Text style={[styles.ratingCount, { color: t.muted, transform: [{ scale: t.textScale }] }]}>(128 avis)</Text>
            </View>
          </View>

          {/* Localisation */}
          <View style={styles.locationSection}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationText, { color: t.text, transform: [{ scale: t.textScale }] }]}>{establishment.address}</Text>
              {establishment.commune && (
                <Text style={[styles.communeText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>{establishment.commune}</Text>
              )}
            </View>
          </View>

          {/* Prévisualisation Satellite (en mode sombre) */}
          {useSatellitePreview && (
            <View style={styles.mapPreviewWrap}>
              <View style={styles.mapPreviewHeader}>
                <Text style={[styles.sectionTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Vue Satellite</Text>
                <TouchableOpacity style={[styles.mapPreviewBtn, { backgroundColor: t.primary }]} onPress={handleOpenMaps}>
                  <Text style={[styles.mapPreviewBtnText, { transform: [{ scale: t.textScale }] }]}>Ouvrir</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.mapPreviewCard, { borderColor: t.border }]}>
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: establishment.coordinates.lat,
                    longitude: establishment.coordinates.lng,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  mapType={previewMapType as any}
                  provider={canForceGoogleProvider ? PROVIDER_GOOGLE : undefined}
                  scrollEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker
                    coordinate={{ latitude: establishment.coordinates.lat, longitude: establishment.coordinates.lng }}
                    pinColor="#2563eb"
                  />
                </MapView>
                <View style={styles.mapPreviewShade} />
              </View>
            </View>
          )}

          {/* Distance */}
          <View style={[styles.distanceCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.distanceContent}>
              <Text style={[styles.distanceLabel, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Distance</Text>
              <Text style={[styles.distanceValue, { color: t.primary, transform: [{ scale: t.textScale }] }]}>{formatDistance(distance)}</Text>
            </View>
            <Text style={styles.distanceIcon}>🧭</Text>
          </View>

          {/* Photos (si disponibles) */}
          {displayPhotos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={[styles.sectionTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosScroll}
              >
                {displayPhotos.map((photo, index) => (
                  <PlaceImage
                    key={`${String(photo)}-${index}`}
                    uri={photo}
                    fallbackSource={photoFallback}
                    id={`${establishment.id}-${index}`}
                    name={establishment.name}
                    category={establishment.category}
                    style={styles.photoThumbnail}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={[styles.sectionTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>À propos</Text>
            <Text style={[styles.descriptionText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>
              {establishment.description}
            </Text>
          </View>

          {/* Commodités (si disponibles) */}
          {establishment.features && establishment.features.length > 0 && (
            <View style={styles.featuresSection}>
              <Text style={[styles.sectionTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Commodités</Text>
              <View style={styles.featuresGrid}>
                {establishment.features.map((feature, index) => (
                  <View key={index} style={[styles.featureChip, { backgroundColor: t.input, borderColor: t.border }]}>
                    <Text style={[styles.featureText, { color: t.text, transform: [{ scale: t.textScale }] }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        {/* Mode de déplacement */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              { backgroundColor: t.input, borderColor: t.border },
              travelMode === 'driving' && [styles.modeBtnActive, { backgroundColor: t.primary, borderColor: t.primary }],
            ]}
            onPress={() => setTravelMode('driving')}
          >
            <Image source={GIF_CAR} style={styles.modeGif} />
            <Text style={[styles.modeBtnText, { color: t.muted, transform: [{ scale: t.textScale }] }, travelMode === 'driving' && styles.modeBtnTextActive]}>
              Voiture
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              { backgroundColor: t.input, borderColor: t.border },
              travelMode === 'walking' && [styles.modeBtnActive, { backgroundColor: t.primary, borderColor: t.primary }],
            ]}
            onPress={() => setTravelMode('walking')}
          >
            <Image source={GIF_WALK} style={styles.modeGif} />
            <Text style={[styles.modeBtnText, { color: t.muted, transform: [{ scale: t.textScale }] }, travelMode === 'walking' && styles.modeBtnTextActive]}>
              À pied
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              { backgroundColor: t.input, borderColor: t.border },
              travelMode === 'bicycling' && [styles.modeBtnActive, { backgroundColor: t.primary, borderColor: t.primary }],
            ]}
            onPress={() => setTravelMode('bicycling')}
          >
            <Image source={GIF_BIKE} style={styles.modeGif} />
            <Text style={[styles.modeBtnText, { color: t.muted, transform: [{ scale: t.textScale }] }, travelMode === 'bicycling' && styles.modeBtnTextActive]}>
              Vélo
            </Text>
          </TouchableOpacity>
        </View>

          {/* Informations de contact */}
          <View style={styles.contactSection}>
            <Text style={[styles.sectionTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Contact</Text>
            {establishment.phone && (
              <TouchableOpacity
                style={[styles.contactItem, { backgroundColor: t.card, borderColor: t.border }]}
                onPress={handleCall}
              >
                <Text style={styles.contactIcon}>📞</Text>
                <Text style={[styles.contactText, { color: t.text, transform: [{ scale: t.textScale }] }]}>{establishment.phone}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.contactItem, { backgroundColor: t.card, borderColor: t.border }]}
              onPress={handleOpenMaps}
            >
              <Text style={styles.contactIcon}>📍</Text>
              <Text style={[styles.contactText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Voir sur la carte</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Espace pour les boutons fixes */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Boutons d'action fixes en bas */}
      <View style={[styles.actionButtons, { backgroundColor: t.card, borderTopColor: t.border }]}>
        {establishment.phone ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.callButton]}
            onPress={handleCall}
          >
            <Text style={styles.actionButtonIcon}>📞</Text>
            <Text style={styles.actionButtonText}>Appeler</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.actionButton, styles.callButtonDisabled]}>
            <Text style={styles.actionButtonIcon}>📞</Text>
            <Text style={styles.actionButtonTextDisabled}>Appeler</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton, { backgroundColor: t.input, borderColor: t.border }]}
          onPress={handleShare}
        >
          <Text style={styles.actionButtonIcon}>📤</Text>
          <Text style={[styles.actionButtonText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Partager</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.navigateButton]}
          onPress={handleNavigate}
        >
          <Text style={styles.actionButtonIcon}>🧭</Text>
          <Text style={styles.actionButtonTextWhite}>Itinéraire</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  netWarn: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.35)', borderWidth: 1, borderRadius: 14, padding: 12 },
  netWarnTitle: { color: '#0b1220', fontWeight: '900', marginBottom: 4 },
  netWarnText: { color: '#0b1220', opacity: 0.75, fontSize: 12, lineHeight: 16 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  heroContainer: {
    position: 'relative',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerButtons: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: { flexDirection: 'row', gap: 10 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 24,
    color: '#2563eb',
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusTextClosed: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginRight: 6,
  },
  ratingCount: {
    fontSize: 14,
    color: '#64748b',
  },
  locationSection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 4,
  },
  communeText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  mapPreviewWrap: {
    marginBottom: 20,
  },
  mapPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapPreviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0b1220',
  },
  mapPreviewBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  mapPreviewCard: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapPreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  distanceCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  distanceContent: {
    flex: 1,
  },
  distanceLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  distanceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  distanceIcon: {
    fontSize: 32,
  },
  photosSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  photosScroll: {
    paddingRight: 16,
  },
  photoThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#e2e8f0',
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  featureText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  contactSection: {
    marginBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  modeGif: { width: 44, height: 30, borderRadius: 10 },
  modeBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeBtnText: {
    color: '#475569',
    fontWeight: '900',
    fontSize: 12,
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  spacer: {
    height: 100,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  callButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  callButtonDisabled: {
    backgroundColor: '#e2e8f0',
    borderColor: '#e2e8f0',
  },
  shareButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  navigateButton: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    flex: 1.5,
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  actionButtonTextDisabled: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  actionButtonTextWhite: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});


