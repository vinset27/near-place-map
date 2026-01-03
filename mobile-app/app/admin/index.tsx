import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { authMe } from '../../services/auth';
import { approveProEvent, approveUserEvent, fetchPendingModeration, rejectProEvent, rejectUserEvent } from '../../services/admin';

const KEY = 'nearplace:adminToken:v1';

export default function AdminScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const [token, setToken] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setToken(String(v || '')));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 15,
    retry: false,
  });
  const isAdminRole = String((me as any)?.role || '') === 'admin';

  const effectiveToken = String(token || '').trim() || undefined;

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin-pending', effectiveToken || 'session'],
    enabled: isAdminRole || !!effectiveToken,
    queryFn: () => fetchPendingModeration({ token: effectiveToken, limit: 200 }),
    staleTime: 1000 * 5,
    retry: false,
  });

  const pendingEvents = useMemo(() => (data as any)?.pending?.events || [], [data]);
  const pendingUserEvents = useMemo(() => (data as any)?.pending?.userEvents || [], [data]);

  const saveToken = async () => {
    await AsyncStorage.setItem(KEY, String(token || '')).catch(() => {});
    setToast('Token sauvegardé.');
    await qc.invalidateQueries({ queryKey: ['admin-pending'] }).catch(() => {});
    void refetch();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>Admin</Text>
          <Text style={[styles.sub, { color: t.muted }]} numberOfLines={1}>
            Modération: publications en attente
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {!!toast && (
          <View style={[styles.toast, { backgroundColor: t.input, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '900' }}>{toast}</Text>
          </View>
        )}

        {!isAdminRole && !effectiveToken && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Accès admin</Text>
            <Text style={[styles.cardText, { color: t.muted }]}>
              Connecte-toi avec un compte admin (role=admin) OU colle ton ADMIN_TOKEN (header x-admin-token).
            </Text>
            <TouchableOpacity style={[styles.primary, { backgroundColor: t.primary }]} onPress={() => router.push('/login')}>
              <Text style={styles.primaryText}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>ADMIN_TOKEN (optionnel)</Text>
          <Text style={[styles.cardText, { color: t.muted }]}>
            Si tu ne veux pas utiliser le role admin, tu peux gérer la modération via ce token.
          </Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="x-admin-token…"
            placeholderTextColor={t.muted}
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={[styles.primary, { backgroundColor: t.primary, flex: 1 }]} onPress={saveToken}>
              <Text style={styles.primaryText}>Sauvegarder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghost, { backgroundColor: t.input, borderColor: t.border, flex: 1 }]}
              onPress={async () => {
                setToken('');
                await AsyncStorage.removeItem(KEY).catch(() => {});
                setToast('Token supprimé.');
                await qc.invalidateQueries({ queryKey: ['admin-pending'] }).catch(() => {});
              }}
            >
              <Text style={[styles.ghostText, { color: t.text }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>En attente</Text>
          {isLoading ? <Text style={[styles.cardText, { color: t.muted }]}>Chargement…</Text> : null}
          {!!error ? <Text style={[styles.cardText, { color: t.muted }]}>{String((error as any)?.message || error)}</Text> : null}

          <View style={{ marginTop: 10 }}>
            <Text style={[styles.kicker, { color: t.muted }]}>Événements établissements</Text>
            {pendingEvents.length === 0 ? (
              <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text>
            ) : (
              pendingEvents.slice(0, 50).map((ev: any) => (
                <View key={String(ev.id)} style={[styles.row, { borderColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '950' }} numberOfLines={1}>
                      {String(ev.title || '—')}
                    </Text>
                    <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>
                      {String(ev.category || 'event')} • {new Date(ev.startsAt).toLocaleString()} • {ev.organizer?.name || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.approve, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                    onPress={async () => {
                      await approveProEvent(String(ev.id), effectiveToken);
                      setToast('Approuvé.');
                      await qc.invalidateQueries({ queryKey: ['admin-pending'] });
                    }}
                  >
                    <Text style={{ color: '#22c55e', fontWeight: '950' }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reject, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                    onPress={async () => {
                      const ok = await new Promise<boolean>((resolve) => {
                        Alert.alert('Rejeter', 'Supprimer cet événement ?', [
                          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
                        ]);
                      });
                      if (!ok) return;
                      await rejectProEvent(String(ev.id), effectiveToken);
                      setToast('Rejeté.');
                      await qc.invalidateQueries({ queryKey: ['admin-pending'] });
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '950' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.kicker, { color: t.muted }]}>Soirées users</Text>
            {pendingUserEvents.length === 0 ? (
              <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text>
            ) : (
              pendingUserEvents.slice(0, 80).map((ue: any) => (
                <View key={String(ue.id)} style={[styles.row, { borderColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: '950' }} numberOfLines={1}>
                      {String(ue.title || '—')}
                    </Text>
                    <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>
                      {String(ue.kind || 'party')} • {new Date(ue.startsAt).toLocaleString()} • {ue.organizer?.name || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.approve, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                    onPress={async () => {
                      await approveUserEvent(String(ue.id), effectiveToken);
                      setToast('Approuvé.');
                      await qc.invalidateQueries({ queryKey: ['admin-pending'] });
                    }}
                  >
                    <Text style={{ color: '#22c55e', fontWeight: '950' }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reject, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                    onPress={async () => {
                      const ok = await new Promise<boolean>((resolve) => {
                        Alert.alert('Rejeter', 'Supprimer cette soirée ?', [
                          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
                        ]);
                      });
                      if (!ok) return;
                      await rejectUserEvent(String(ue.id), effectiveToken);
                      setToast('Rejeté.');
                      await qc.invalidateQueries({ queryKey: ['admin-pending'] });
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '950' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
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
  toast: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  cardTitle: { fontWeight: '950', fontSize: 14 },
  cardText: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, fontWeight: '800' },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '950' },
  ghost: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  ghostText: { fontWeight: '950' },
  kicker: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  approve: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reject: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});





