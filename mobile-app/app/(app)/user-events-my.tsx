import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { authMe } from '../../services/auth';
import { deleteUserEvent, fetchMyUserEvents } from '../../services/userEventsApi';
import { formatDistance } from '../../services/location';

export default function MyUserEventsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me;

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-events-me'],
    enabled: isAuthed,
    queryFn: () => fetchMyUserEvents(),
    staleTime: 1000 * 10,
    retry: false,
  });

  const items = Array.isArray(data) ? data : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]}>Mes soirées</Text>
          <Text style={[styles.sub, { color: t.muted, transform: [{ scale: t.textScale }] }]}>Gère tes publications</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/user-event-create', params: { kind: 'party' } } as any)}
          style={[styles.primary, { backgroundColor: t.primary }]}
        >
          <Text style={styles.primaryText}>＋</Text>
        </TouchableOpacity>
      </View>

      {!isAuthed ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.text, fontWeight: '950' }}>Connexion requise</Text>
          <TouchableOpacity style={[styles.bigBtn, { backgroundColor: t.primary }]} onPress={() => router.replace('/login')}>
            <Text style={styles.bigBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.muted, fontWeight: '800' }}>Chargement…</Text>
        </View>
      ) : !!error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.text, fontWeight: '950' }}>Impossible de charger</Text>
          <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }}>{String((error as any)?.message || error)}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.text, fontWeight: '950' }}>Aucune soirée</Text>
          <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }}>Crée ta première soirée ou point de rencontre.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: t.primary, flex: 1 }]}
              onPress={() => router.push({ pathname: '/user-event-create', params: { kind: 'party' } } as any)}
            >
              <Text style={styles.bigBtnText}>Organiser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bigBtn, { backgroundColor: t.input, borderColor: t.border, borderWidth: 1, flex: 1 }]}
              onPress={() => router.push({ pathname: '/user-event-create', params: { kind: 'meet' } } as any)}
            >
              <Text style={[styles.bigBtnText, { color: t.text }]}>Rencontre</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={items as any}
          keyExtractor={(x: any) => String(x.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
          renderItem={({ item }: any) => (
            <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '950' }} numberOfLines={1}>
                  {String(item.title)}
                </Text>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>
                  {String(item.kind) === 'meet' ? 'Point de rencontre' : 'Soirée'} • {new Date(item.startsAt).toLocaleString()}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: item.published ? 'rgba(34,197,94,0.14)' : 'rgba(251,191,36,0.14)', borderColor: item.published ? 'rgba(34,197,94,0.30)' : 'rgba(251,191,36,0.35)' },
                    ]}
                  >
                    <Text style={{ color: item.published ? '#22c55e' : '#f59e0b', fontWeight: '950', fontSize: 11 }}>
                      {item.published ? 'PUBLIÉ' : 'EN ATTENTE'}
                    </Text>
                  </View>
                  <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={1}>
                    {item.published ? 'Visible sur la carte' : 'Validation admin requise'}
                  </Text>
                </View>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>
                  {Number.isFinite(Number(item.distanceMeters)) ? `Distance: ${formatDistance(Number(item.distanceMeters))}` : `📍 ${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const ok = await new Promise<boolean>((resolve) => {
                    Alert.alert('Supprimer', 'Supprimer cette soirée ?', [
                      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
                      { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
                    ]);
                  });
                  if (!ok) return;
                  await deleteUserEvent(String(item.id));
                  await qc.invalidateQueries({ queryKey: ['user-events-me'] });
                  await qc.invalidateQueries({ queryKey: ['user-events'] });
                }}
                style={[styles.delBtn, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
              >
                <Text style={{ color: '#ef4444', fontWeight: '950' }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backText: { fontWeight: '900', fontSize: 18 },
  title: { fontWeight: '950', fontSize: 16 },
  sub: { marginTop: 4, fontWeight: '800', fontSize: 12 },
  primary: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '950', fontSize: 18, marginTop: -1 },
  bigBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontWeight: '950' },
  row: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  delBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
});


