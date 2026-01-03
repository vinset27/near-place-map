/**
 * Écran Liste des établissements
 * Correspond à la page List.tsx du projet web
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchEstablishmentsNearby, toUiEstablishment } from '../../services/establishments';
import { useCurrentLocation } from '../../stores/useLocationStore';
import { ESTABLISHMENT_CATEGORIES, Establishment } from '../../types/establishment';
import { haversineDistance } from '../../services/location';
import { getCurrentLocation, watchLocation } from '../../services/location';
import { useLocationStore } from '../../stores/useLocationStore';
import { EstablishmentFeedCard } from '../../components/Cards/EstablishmentFeedCard';
import { EstablishmentFeedCardSkeleton } from '../../components/Skeletons/EstablishmentFeedCardSkeleton';
import { useFavoritesStore } from '../../stores/useFavoritesStore';
import { OfflineBanner } from '../../components/UI/OfflineBanner';
import { useStableQueryOrigin } from '../../services/queryOrigin';
import { useAppTheme } from '../../services/settingsTheme';
import LottieView from 'lottie-react-native';
import { authMe } from '../../services/auth';
import { setFavorite } from '../../services/favoritesApi';

const LOCATION_LOADER = require('../../assets/Location.json');

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

export default function ListScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const userLocation = useCurrentLocation();
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const stableOrigin = useStableQueryOrigin(userLocation);
  const origin = useMemo(() => {
    if (rawUserLocation) return { lat: round4(rawUserLocation.lat), lng: round4(rawUserLocation.lng) };
    return stableOrigin;
  }, [rawUserLocation, stableOrigin]);
  const { hasPermission, setUserLocation, setIsTracking } = useLocationStore();

  // Keep typing smooth: do NOT refetch on every keystroke.
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25 | 50 | 200>(10);
  const favItems = useFavoritesStore((s) => s.items);
  const toggleFav = useFavoritesStore((s) => s.toggle);

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me;

  const toggleFavoriteGuarded = async (est: Establishment) => {
    if (!isAuthed) {
      router.push('/login');
      return;
    }
    const id = String(est?.id || '').trim();
    if (!id) return;
    const was = !!favItems[id];
    const next = !was;
    toggleFav(est);
    try {
      await setFavorite({ establishmentId: id, active: next });
    } catch {
      toggleFav(est);
    }
  };

  // Ensure list works even if user never opened the Map tab (start GPS tracking here too)
  useEffect(() => {
    if (!hasPermission) return;
    let stopWatching: (() => void) | null = null;

    getCurrentLocation().then((loc) => setUserLocation(loc));
    watchLocation((loc) => setUserLocation(loc)).then((stop) => {
      stopWatching = stop;
    });

    setIsTracking(true);
    return () => {
      stopWatching?.();
      setIsTracking(false);
    };
  }, [hasPermission, setIsTracking, setUserLocation]);

  const canQuery = !hasPermission || !!rawUserLocation;

  // Debounce search input (local filtering only)
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchDraft), 220);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const { data: establishments, isLoading, error } = useQuery({
    queryKey: ['list-establishments', origin.lat, origin.lng, radiusKm, selectedCategory],
    queryFn: async () => {
      const apiData = await fetchEstablishmentsNearby({
        lat: origin.lat,
        lng: origin.lng,
        radiusKm,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        // Search is local to avoid reloading the whole list at each keypress.
        // Avoid truncating results for larger radiuses (server supports up to 5000).
        limit: radiusKm >= 200 ? 5000 : radiusKm >= 50 ? 3500 : 1200,
      });
      return apiData.map(toUiEstablishment);
    },
    enabled: canQuery,
    // Keep list stable: don't auto-refetch once loaded (unless filters/origin key changes).
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const filteredEstablishments = useMemo(() => {
    if (!establishments) return [];
    return establishments
      // distances should be computed from the same stabilized origin used for fetching
      .map((est) => ({ ...est, distanceMeters: haversineDistance(origin, est.coordinates) }))
      .filter((est) => {
        if ((est.distanceMeters || 0) > radiusKm * 1000) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const text = `${est.name} ${est.address} ${est.commune} ${est.category}`.toLowerCase();
          if (!text.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
  }, [establishments, origin, radiusKm, searchQuery]);

  const suggestions = useMemo(() => {
    const raw = String(searchDraft || '').trim().toLowerCase();
    if (raw.length < 2) return [];
    const src = Array.isArray(establishments) ? establishments : [];
    const out: Array<{ id: string; label: string }> = [];
    for (const e of src) {
      const name = String((e as any)?.name || '').trim();
      const commune = String((e as any)?.commune || '').trim();
      const address = String((e as any)?.address || '').trim();
      const cat = String((e as any)?.category || '').trim();
      const hay = `${name} ${commune} ${address} ${cat}`.toLowerCase();
      if (!hay.includes(raw)) continue;
      if (name) out.push({ id: `n:${String((e as any)?.id || name)}`, label: name });
      if (out.length >= 8) break;
    }
    const seen = new Set<string>();
    return out.filter((x) => {
      const k = x.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [establishments, searchDraft]);

  const renderItem = ({ item }: { item: Establishment }) => (
    <View style={{ paddingHorizontal: 16 }}>
      <EstablishmentFeedCard
        item={item}
        onPress={() => router.push(`/establishment/${item.id}`)}
        favorite={{ active: !!favItems[item.id], onToggle: () => void toggleFavoriteGuarded(item) }}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      {isLoading && (
        <View style={styles.loaderWrap}>
          <LottieView source={LOCATION_LOADER} autoPlay loop style={{ width: 150, height: 150 }} />
          <Text style={[styles.loaderTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Chargement…</Text>
          <Text style={[styles.loaderSub, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Établissements proches de vous</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Impossible de charger</Text>
          <Text style={[styles.errorText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>{String((error as any)?.message || error)}</Text>
        </View>
      )}

      {!isLoading && !error && filteredEstablishments.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { color: t.text, transform: [{ scale: t.textScale }] }]}>🔍</Text>
          <Text style={[styles.emptyText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Aucun établissement trouvé</Text>
          <Text style={[styles.emptySubtext, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Élargis le rayon ou change les filtres.</Text>
        </View>
      )}

      {!isLoading && !error && (
        <FlatList
          data={filteredEstablishments}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
              <View style={styles.headerTopRow}>
                <Text style={[styles.headerTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Autour de vous</Text>
                <View style={[styles.countPill, { backgroundColor: t.input, borderColor: t.border }]}>
                  <Text style={[styles.countPillText, { color: t.text, transform: [{ scale: t.textScale }] }]}>
                    {filteredEstablishments.length}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <OfflineBanner />
              </View>

              {hasPermission && !rawUserLocation && (
                <View style={[styles.gpsPill, { backgroundColor: t.input, borderColor: t.border }]}>
                  <Text style={[styles.gpsPillText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Recherche de votre position…</Text>
                </View>
              )}
              {!hasPermission && (
                <View style={[styles.gpsPill, { backgroundColor: t.input, borderColor: t.border }]}>
                  <Text style={[styles.gpsPillText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Position par défaut (GPS non activé)</Text>
                </View>
              )}

              <View style={[styles.searchBar, { backgroundColor: t.input }]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, { color: t.text, transform: [{ scale: t.textScale }] }]}
                  placeholder="Rechercher un lieu, un quartier…"
                  placeholderTextColor={t.muted}
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  returnKeyType="search"
                  enablesReturnKeyAutomatically
                  autoCorrect={false}
                  autoCapitalize="none"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {suggestions.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.suggestTitle, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Suggestions</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, gap: 8, marginTop: 8 }}>
                    {suggestions.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.9}
                        onPress={() => {
                          setSearchDraft(s.label);
                          setSearchQuery(s.label);
                          Keyboard.dismiss();
                        }}
                        style={[styles.suggestChip, { backgroundColor: t.input, borderColor: t.border }]}
                      >
                        <Text style={[styles.suggestChipText, { color: t.text, transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    { backgroundColor: t.input, borderColor: t.border },
                    selectedCategory === 'all' && styles.categoryChipActive,
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
                      selectedCategory === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: t.muted, transform: [{ scale: t.textScale }] },
                        selectedCategory === cat.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={[styles.radiusSelector, { backgroundColor: t.input }]}>
                {[5, 10, 25, 50, 200].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusButton, radiusKm === r && styles.radiusButtonActive]}
                    onPress={() => setRadiusKm(r as any)}
                  >
                    <Text
                      style={[
                        styles.radiusButtonText,
                        { color: t.muted, transform: [{ scale: t.textScale }] },
                        radiusKm === r && styles.radiusButtonTextActive,
                      ]}
                    >
                      {r === 200 ? 'CI' : `${r}km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {filteredEstablishments.length > 0 && (
                <Text style={[styles.countText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>
                  {filteredEstablishments.length} résultat(s)
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon, { color: t.text, transform: [{ scale: t.textScale }] }]}>🔍</Text>
              <Text style={[styles.emptyText, { color: t.text, transform: [{ scale: t.textScale }] }]}>Aucun établissement trouvé</Text>
              <Text style={[styles.emptySubtext, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Élargis le rayon ou change les filtres.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loaderTitle: { fontSize: 16, fontWeight: '950', marginTop: 6 },
  loaderSub: { marginTop: 4, fontWeight: '800' },
  header: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '950', color: '#0b1220', marginBottom: 6, letterSpacing: -0.3 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countPill: { minWidth: 44, height: 34, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  countPillText: { fontWeight: '950' },
  gpsPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  gpsPillText: { color: '#0b1220', fontWeight: '900', fontSize: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  suggestTitle: { fontSize: 12, fontWeight: '900' },
  suggestChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, maxWidth: 240 },
  suggestChipText: { fontWeight: '900', fontSize: 12 },
  categoriesContent: { paddingRight: 16, paddingBottom: 10 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  categoryChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  categoryChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  categoryChipTextActive: { color: '#ffffff' },
  radiusSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  radiusButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  radiusButtonActive: { backgroundColor: '#2563eb' },
  radiusButtonText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  radiusButtonTextActive: { color: '#ffffff' },
  // Important: keep header full-width. Apply horizontal padding per-item instead.
  listContent: { paddingTop: 14, paddingBottom: 110 },
  countText: { marginTop: 10, color: '#64748b', fontWeight: '800', fontSize: 12 },
  // Note: tabBar height is 62 (+ safe area). Keep enough bottom padding so last cards aren't hidden.
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },
  errorContainer: { padding: 16 },
  errorTitle: { fontWeight: '900', color: '#0b1220', marginBottom: 4 },
  errorText: { color: '#0b1220', opacity: 0.8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '900', color: '#0b1220', marginBottom: 6, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});



