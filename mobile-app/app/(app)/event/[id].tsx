import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../services/settingsTheme';
import { fetchEventById } from '../../../services/eventsById';
import { AppHeader } from '../../../components/UI/AppHeader';
import { PlaceImage } from '../../../components/UI/PlaceImage';
import { authMe } from '../../../services/auth';

export default function EventDetailsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id || '').trim();

  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const myId = String((me as any)?.id || '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['event', id],
    enabled: !!id,
    queryFn: () => fetchEventById(id),
    staleTime: 1000 * 20,
    retry: false,
  });

  const ev: any = data || null;
  const est = ev?.establishment || null;
  const media = useMemo(() => {
    const photos = Array.isArray(ev?.photos) ? ev.photos : [];
    const videos = Array.isArray(ev?.videos) ? ev.videos : [];
    const cover = ev?.coverUrl ? [String(ev.coverUrl)] : [];
    const uniq = (arr: string[]) => Array.from(new Set(arr.map((x) => String(x).trim()).filter(Boolean)));
    return { photos: uniq([...cover, ...photos]), videos: uniq(videos) };
  }, [ev]);

  const status = String(ev?.moderationStatus || (ev?.published ? 'approved' : 'pending')).toLowerCase();
  const isOwner = myId && String(ev?.userId || '') === myId;
  const coords = { lat: Number(ev?.lat), lng: Number(ev?.lng) };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <AppHeader title="Événement" subtitle={est?.name ? String(est.name) : 'Détails'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {!!error && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '950' }}>Impossible de charger</Text>
            <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }}>{String((error as any)?.message || error)}</Text>
          </View>
        )}

        {isLoading ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={{ color: t.muted, fontWeight: '800' }}>Chargement…</Text>
          </View>
        ) : !ev ? null : (
          <>
            <View style={[styles.heroCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <PlaceImage
                uri={media.photos[0] || (est?.photos?.[0] ?? est?.imageUrl ?? null)}
                id={`ev-${id}`}
                name={String(ev.title || 'Événement')}
                category={String(ev.category || 'event')}
                style={styles.heroImg}
                textSize={46}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '950', fontSize: 18 }} numberOfLines={2}>
                  {String(ev.title || '—')}
                </Text>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }} numberOfLines={2}>
                  {new Date(ev.startsAt).toLocaleString()}
                </Text>
                {!!ev.description && (
                  <Text style={{ color: t.muted, fontWeight: '800', marginTop: 10 }} numberOfLines={3}>
                    {String(ev.description)}
                  </Text>
                )}

                {isOwner && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: status === 'approved' ? 'rgba(34,197,94,0.14)' : status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.14)',
                          borderColor: status === 'approved' ? 'rgba(34,197,94,0.30)' : status === 'rejected' ? 'rgba(239,68,68,0.26)' : 'rgba(251,191,36,0.35)',
                        },
                      ]}
                    >
                      <Text style={{ fontWeight: '950', fontSize: 11, color: status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f59e0b' }}>
                        {status === 'approved' ? 'ACCEPTÉ' : status === 'rejected' ? 'REFUSÉ' : 'EN ATTENTE'}
                      </Text>
                    </View>
                    {!!ev.moderationReason && status === 'rejected' && (
                      <Text style={{ color: t.muted, fontWeight: '800', flex: 1 }} numberOfLines={2}>
                        {String(ev.moderationReason)}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={{ color: t.text, fontWeight: '950' }}>Médias</Text>
              {media.photos.length === 0 && media.videos.length === 0 ? (
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 8 }}>— Aucun média</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16, marginTop: 10 }}>
                  {media.photos.map((u) => (
                    <View key={u} style={{ width: 120, height: 90, borderRadius: 18, overflow: 'hidden', backgroundColor: t.input }}>
                      <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} />
                    </View>
                  ))}
                  {media.videos.map((u) => (
                    <View key={u} style={{ width: 120, height: 90, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '950' }}>VIDEO</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={[styles.ctaGhost, { backgroundColor: t.input, borderColor: t.border }]}
                onPress={async () => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
                  const msg = `Événement: ${String(ev.title || '')}\nLieu: ${url}\n\nDécouvre O'Show: https://near-place-map.onrender.com/`;
                  await Share.share({ message: msg }).catch(() => {});
                }}
              >
                <Text style={{ color: t.text, fontWeight: '900' }}>Partager</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ctaPrimary, { backgroundColor: t.primary }]}
                onPress={() =>
                  router.push({
                    pathname: '/navigation',
                    params: {
                      mode: 'driving',
                      lat: String(coords.lat),
                      lng: String(coords.lng),
                      name: String(ev.title || 'Événement'),
                      category: 'event',
                    },
                  } as any)
                }
              >
                <Text style={{ color: '#fff', fontWeight: '900' }}>Itinéraire</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  heroCard: { borderRadius: 22, borderWidth: 1, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 12 },
  heroImg: { width: 92, height: 92, borderRadius: 22, backgroundColor: '#e2e8f0' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ctaPrimary: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ctaGhost: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
});










