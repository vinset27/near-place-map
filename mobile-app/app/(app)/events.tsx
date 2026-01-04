import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentLocation } from '../../stores/useLocationStore';
import { useLocationStore } from '../../stores/useLocationStore';
import { demoEvents, EstablishmentEvent, fetchEventsNearby } from '../../services/events';
import { EstablishmentCard } from '../../components/Cards/EstablishmentCard';
import { useStableQueryOrigin } from '../../services/queryOrigin';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { useAppTheme } from '../../services/settingsTheme';
import { haversineDistance, formatDistance } from '../../services/location';
import { authMe } from '../../services/auth';
import { toUiEstablishment } from '../../services/establishments';
import { AppHeader } from '../../components/UI/AppHeader';

export default function EventsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const userLocation = useCurrentLocation();
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const hasPermission = useLocationStore((s) => s.hasPermission);
  const origin = useStableQueryOrigin(userLocation);
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 25 | 50 | 200>(25);
  const [tab, setTab] = useState<'all' | 'live' | 'promo' | 'event'>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Events are now fetched from backend (fallback to demo if API offline).
  const canQuery = !hasPermission || !!rawUserLocation;

  const { data: apiEvents, error, isLoading } = useQuery({
    queryKey: ['events', origin.lat, origin.lng, radiusKm],
    enabled: canQuery,
    queryFn: () => fetchEventsNearby({ lat: origin.lat, lng: origin.lng, radiusKm, withinHours: 72, limit: 350 }),
    staleTime: 1000 * 20,
    retry: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me;

  const isDemo = !apiEvents || apiEvents.length === 0;

  const events = useMemo<any[]>(() => {
    const base = apiEvents && apiEvents.length ? (apiEvents as any[]) : (demoEvents as any[]);
    const withDistance = base.map((ev: any) => {
      const dm = Number(ev?.distanceMeters);
      if (Number.isFinite(dm) && dm > 0) return { ...ev, _distanceMeters: dm };
      const est = ev?.establishment;
      const lat = Number(est?.coordinates?.lat ?? est?.lat);
      const lng = Number(est?.coordinates?.lng ?? est?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { ...ev, _distanceMeters: haversineDistance(origin, { lat, lng }) };
      }
      return { ...ev, _distanceMeters: null };
    });

    const filtered = withDistance
      .filter((ev: any) => {
        const c = String(ev?.category || 'event').toLowerCase();
        if (tab === 'all') return true;
        return c === tab;
      })
      .sort((a: any, b: any) => {
        const da = a?._distanceMeters;
        const db = b?._distanceMeters;
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });

    return filtered;
  }, [apiEvents, origin, tab]);

  const liveEvents = useMemo(() => events.filter((e: any) => String(e?.category || '').toLowerCase() === 'live'), [events]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <AppHeader title="Événements" subtitle="Lives, promos, soirées • triés par proximité" onBack={() => router.back()} />
      <View style={[styles.header, { backgroundColor: t.bg, borderBottomColor: t.border }]}>

        {!!toast && (
          <View style={[styles.toast, { backgroundColor: t.input, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '900', transform: [{ scale: t.textScale }] }}>{toast}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!isAuthed) return router.push('/login');
              router.push({ pathname: '/user-event-create', params: { kind: 'party' } } as any);
            }}
            style={[styles.cta, { backgroundColor: t.primary }]}
          >
            <Text style={styles.ctaText}>Organiser une soirée</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!isAuthed) return router.push('/login');
              router.push({ pathname: '/user-event-create', params: { kind: 'meet' } } as any);
            }}
            style={[styles.ctaGhost, { borderColor: t.border, backgroundColor: t.input }]}
          >
            <Text style={[styles.ctaGhostText, { color: t.text }]}>Créer un point de rencontre</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.radiusSelector, { backgroundColor: t.input, borderColor: t.border }]}>
          {[5, 10, 25, 50, 200].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusBtn, radiusKm === r && { backgroundColor: t.primary }]}
              onPress={() => setRadiusKm(r as any)}
              activeOpacity={0.9}
            >
              <Text style={[styles.radiusText, { color: radiusKm === r ? '#fff' : t.muted, transform: [{ scale: t.textScale }] }]}>
                {r === 200 ? 'CI' : `${r}km`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, gap: 8, marginTop: 10 }}>
          {[
            { key: 'all', label: 'Tout' },
            { key: 'live', label: 'Lives' },
            { key: 'promo', label: 'Promos' },
            { key: 'event', label: 'Soirées' },
          ].map((x) => (
            <TouchableOpacity
              key={x.key}
              activeOpacity={0.9}
              onPress={() => setTab(x.key as any)}
              style={[
                styles.tabChip,
                { backgroundColor: t.input, borderColor: t.border },
                tab === x.key && { backgroundColor: t.primary, borderColor: t.primary },
              ]}
            >
              <Text style={[styles.tabChipText, { color: tab === x.key ? '#fff' : t.text, transform: [{ scale: t.textScale }] }]}>{x.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!error && (
        <View style={styles.errBox}>
          <Text style={[styles.errTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Mode démo / hors‑ligne</Text>
          <Text style={[styles.errText, { color: t.text, transform: [{ scale: t.textScale }] }]}>{String((error as any)?.message || error)}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: 16 }}>
          <View style={[styles.skel, { backgroundColor: t.skeleton }]} />
          <View style={[styles.skel, { backgroundColor: t.skeleton, height: 110 }]} />
          <View style={[styles.skel, { backgroundColor: t.skeleton, height: 110 }]} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon, { color: t.text, transform: [{ scale: t.textScale }] }]}>📅</Text>
          <Text style={[styles.emptyTitle, { color: t.text, transform: [{ scale: t.textScale }] }]}>Aucun événement détecté</Text>
          <Text style={[styles.emptyText, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Essaie une autre zone ou reviens plus tard.</Text>
        </View>
      ) : (
        <FlatList
          data={events as any}
          keyExtractor={(e: any) => e.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            liveEvents.length ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
                <Text style={{ color: t.text, fontWeight: '950', fontSize: 14, transform: [{ scale: t.textScale }] }}>LIVE maintenant</Text>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4, transform: [{ scale: t.textScale }] }}>
                  Les meilleurs lives autour de toi
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, gap: 12, marginTop: 10 }}>
                  {liveEvents.slice(0, 8).map((ev: any) => (
                    <LiveCard
                      key={String(ev.id)}
                      item={ev}
                      onPressEstablishment={() => {
                        if (isDemo) {
                          setToast("Mode démo: les établissements ne sont pas disponibles (backend hors‑ligne).");
                          setTimeout(() => setToast(null), 2200);
                          return;
                        }
                        const estId = ev?.establishment?.id || ev?.establishmentId;
                        if (estId) {
                          try {
                            const est = ev?.establishment;
                            if (est) qc.setQueryData(['establishment', String(estId)], toUiEstablishment(est));
                          } catch {}
                          router.push(`/establishment/${estId}`);
                        }
                      }}
                    />
                  ))}
                </ScrollView>
                <View style={{ height: 10 }} />
                <Text style={{ color: t.text, fontWeight: '950', fontSize: 14, transform: [{ scale: t.textScale }] }}>À proximité</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                <Text style={{ color: t.text, fontWeight: '950', fontSize: 14, transform: [{ scale: t.textScale }] }}>À proximité</Text>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4, transform: [{ scale: t.textScale }] }}>
                  Triés par distance • rayon {radiusKm === 200 ? 'CI' : `${radiusKm}km`}
                </Text>
              </View>
            )
          }
          renderItem={({ item }: any) => (
            <EventCard
              item={item as any}
              onPressDetails={() => {
                if (isDemo) {
                  setToast("Mode démo: les détails ne sont pas disponibles (backend hors‑ligne).");
                  setTimeout(() => setToast(null), 2200);
                  return;
                }
                const evId = String(item?.id || '').trim();
                if (!evId) return;
                router.push(`/event/${evId}` as any);
              }}
              onPressEstablishment={() => {
                if (isDemo) {
                  setToast("Mode démo: les établissements ne sont pas disponibles (backend hors‑ligne).");
                  setTimeout(() => setToast(null), 2200);
                  return;
                }
                const estId = item?.establishment?.id || item?.establishmentId;
                if (estId) {
                  try {
                    const est = item?.establishment;
                    if (est) qc.setQueryData(['establishment', String(estId)], toUiEstablishment(est));
                  } catch {}
                  router.push(`/establishment/${estId}`);
                }
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function LiveCard(props: { item: any; onPressEstablishment: () => void }) {
  const { item, onPressEstablishment } = props;
  const t = useAppTheme();
  const est = item.establishment;
  const cover =
    (item?.coverUrl as string | null) ||
    (est?.photos && est.photos.length ? est.photos[0] : null) ||
    est?.imageUrl ||
    null;
  const dist = item?._distanceMeters != null ? formatDistance(Number(item._distanceMeters)) : null;
  const watchUrl = String(item?.liveUrl || item?.videoUrl || '').trim();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPressEstablishment}
      style={[styles.liveCard, { borderColor: t.border, backgroundColor: t.card }]}
    >
      <PlaceImage uri={cover} id={`${String(item.id)}-live`} name={String(item.title)} category={est?.category} style={styles.liveImg} textSize={28} />
      <View style={styles.liveShade} />
      <View style={styles.liveTopRow}>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
        {!!dist && <Text style={styles.liveMeta}>{dist}</Text>}
      </View>
      <View style={styles.liveBottomRow}>
        <Text style={styles.liveTitle} numberOfLines={2}>
          {String(item.title || 'Live')}
        </Text>
        {!!watchUrl && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(watchUrl).catch(() => {});
            }}
            style={[styles.watchBtn, { backgroundColor: t.primary }]}
          >
            <Text style={styles.watchBtnText}>Regarder</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EventCard(props: {
  item: any;
  onPressEstablishment: () => void;
  onPressDetails: () => void;
}) {
  const { item, onPressEstablishment, onPressDetails } = props;
  const t = useAppTheme();
  const est = item.establishment;
  const dist = item?._distanceMeters != null ? formatDistance(Number(item._distanceMeters)) : null;
  const cover =
    (item?.coverUrl as string | null) ||
    (est?.photos && est.photos.length ? est.photos[0] : null) ||
    est?.imageUrl ||
    null;
  const orgName = item?.organizer?.name || est?.name || 'Organisateur';
  const orgAvatar = item?.organizer?.avatarUrl || cover;
  const watchUrl = String(item?.liveUrl || item?.videoUrl || '').trim();

  return (
    <View style={[styles.eventCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={onPressDetails} style={styles.coverWrap}>
        <PlaceImage uri={cover} id={`${String(item.id)}-cover`} name={String(item.title)} category={est?.category} style={styles.cover} textSize={42} />
        <View style={styles.coverShade} />

        <View style={styles.coverTopRow}>
          <View style={styles.eventBadgePill}>
            <Text style={styles.eventBadge}>{String(item.category || 'event').toUpperCase()}</Text>
          </View>
          <Text style={styles.eventWhen}>
            {dist ? `${dist} • ` : ''}
            {new Date(item.startsAt).toLocaleString()}
          </Text>
        </View>

        <View style={styles.coverBottomRow}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.organizerRow}>
            <View style={styles.organizerAvatar}>
              <PlaceImage uri={orgAvatar} id={`${String(est?.id || 'org')}-avatar`} name={String(orgName || '')} category={est?.category || 'organizer'} style={styles.organizerAvatarImg} textSize={16} />
            </View>
            <Text style={styles.organizerName} numberOfLines={1}>
              {String(orgName)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {!!est && (
        <View style={{ marginTop: 10 }}>
          {!!watchUrl && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => Linking.openURL(watchUrl).catch(() => {})}
              style={[styles.watchCta, { backgroundColor: t.primary }]}
            >
              <Text style={styles.watchCtaText}>{String(item.category || '').toLowerCase() === 'live' ? 'Regarder le live' : 'Voir la vidéo'}</Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPressEstablishment} style={[styles.ctaGhost, { flex: 1, borderColor: t.border, backgroundColor: t.input }]}>
              <Text style={[styles.ctaGhostText, { color: t.text }]}>Voir lieu</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} onPress={onPressDetails} style={[styles.cta, { flex: 1, backgroundColor: t.primary }]}>
              <Text style={styles.ctaText}>Détails</Text>
            </TouchableOpacity>
          </View>
          <EstablishmentCard item={est} onPress={onPressEstablishment} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '900', color: '#0b1220' },
  sub: { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: '700' },
  radiusSelector: { marginTop: 10, flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4 },
  radiusBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  radiusText: { fontWeight: '950', fontSize: 12 },
  tabChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  tabChipText: { fontWeight: '950', fontSize: 12 },
  toast: { marginTop: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  cta: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '950' },
  ctaGhost: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  ctaGhostText: { fontWeight: '950' },
  errBox: { margin: 16, backgroundColor: 'rgba(251,191,36,0.14)', borderColor: 'rgba(251,191,36,0.35)', borderWidth: 1, borderRadius: 16, padding: 12 },
  errTitle: { color: '#0b1220', fontWeight: '950', marginBottom: 4 },
  errText: { color: '#0b1220', opacity: 0.75, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },
  eventCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
  coverWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#e2e8f0' },
  cover: { width: '100%', height: 170, backgroundColor: '#e2e8f0' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  coverTopRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventBadgePill: { backgroundColor: 'rgba(11,18,32,0.88)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  eventBadge: { color: '#fff', fontWeight: '900', fontSize: 11 },
  eventWhen: { color: 'rgba(255,255,255,0.92)', fontWeight: '800', fontSize: 12 },
  coverBottomRow: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8 },
  eventTitle: { color: '#fff', fontWeight: '950', fontSize: 16, lineHeight: 20 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  organizerAvatar: { width: 26, height: 26, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  organizerAvatarImg: { width: 26, height: 26, borderRadius: 13 },
  organizerName: { color: 'rgba(255,255,255,0.90)', fontWeight: '800', fontSize: 12, flex: 1 },
  watchCta: { marginBottom: 10, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  watchCtaText: { color: '#fff', fontWeight: '950' },
  liveCard: { width: 260, height: 150, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  liveImg: { width: '100%', height: '100%' },
  liveShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  liveTopRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: { backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  livePillText: { color: '#fff', fontWeight: '950', fontSize: 11, letterSpacing: 0.3 },
  liveMeta: { color: 'rgba(255,255,255,0.92)', fontWeight: '900', fontSize: 12 },
  liveBottomRow: { position: 'absolute', left: 10, right: 10, bottom: 10, gap: 8 },
  liveTitle: { color: '#fff', fontWeight: '950', fontSize: 14, lineHeight: 18 },
  watchBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  watchBtnText: { color: '#fff', fontWeight: '950', fontSize: 12 },
  skel: { height: 18, borderRadius: 12, marginBottom: 12, opacity: 0.9 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0b1220', marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});


