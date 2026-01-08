import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { authMe } from '../../services/auth';
import { fetchMyTrips, type UserTrip } from '../../services/trips';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function TripsScreen() {
  const t = useAppTheme();
  const router = useRouter();

  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const isAuthed = !!me;

  const { data, isLoading } = useQuery({
    queryKey: ['trips-me'],
    enabled: isAuthed,
    queryFn: () => fetchMyTrips({ limit: 120 }),
    staleTime: 1000 * 15,
    retry: false,
  });

  const trips = useMemo(() => (data || []) as UserTrip[], [data]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]}>Mes trajets</Text>
          <Text style={[styles.sub, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Historique des itinéraires enregistrés</Text>
        </View>
      </View>

      {!isAuthed ? (
        <View style={{ padding: 16 }}>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Connexion requise</Text>
            <Text style={[styles.cardText, { color: t.muted }]}>Connecte-toi pour enregistrer et consulter tes trajets.</Text>
            <TouchableOpacity style={[styles.primary, { backgroundColor: t.primary }]} onPress={() => router.push('/login')}>
              <Text style={styles.primaryText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isLoading ? (
        <View style={{ padding: 16 }}>
          <View style={[styles.skel, { backgroundColor: t.skeleton }]} />
          <View style={[styles.skel, { backgroundColor: t.skeleton }]} />
          <View style={[styles.skel, { backgroundColor: t.skeleton }]} />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon, { color: t.text }]}>🧭</Text>
          <Text style={[styles.emptyTitle, { color: t.text }]}>Aucun trajet</Text>
          <Text style={[styles.emptyText, { color: t.muted }]}>Lance un itinéraire depuis la carte, il apparaîtra ici.</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const name = String(item.destination_name || 'Destination');
            const lat = Number(item.destination_lat);
            const lng = Number(item.destination_lng);
            const canNav = Number.isFinite(lat) && Number.isFinite(lng);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  if (!canNav) return;
                  router.push({
                    pathname: '/navigation',
                    params: {
                      mode: String(item.mode || 'driving'),
                      lat: String(lat),
                      lng: String(lng),
                      name,
                      category: 'other',
                    },
                  } as any);
                }}
                style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '950' }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>
                    {String(item.destination_type)} • {String(item.mode || '—')} • {formatWhen(String(item.created_at))}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: t.input, borderColor: t.border }]}>
                  <Text style={{ color: t.text, fontWeight: '900' }}>Go</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '950', fontSize: 16 },
  sub: { marginTop: 4, fontWeight: '800', fontSize: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  cardTitle: { fontWeight: '950', fontSize: 14 },
  cardText: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  primary: { marginTop: 8, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '950' },
  skel: { height: 84, borderRadius: 18, marginBottom: 12, opacity: 0.7 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { fontWeight: '950', fontSize: 16 },
  emptyText: { marginTop: 6, fontWeight: '800', textAlign: 'center' },
  row: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});










