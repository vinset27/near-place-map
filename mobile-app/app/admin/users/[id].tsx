import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../services/settingsTheme';
import { authMe } from '../../../services/auth';
import {
  approveEstablishment,
  approveProEvent,
  approveUserEvent,
  deleteEstablishment,
  deleteProEvent,
  deleteUserEvent,
  fetchAdminUserDetails,
  rejectEstablishment,
  rejectProEvent,
  rejectUserEvent,
} from '../../../services/admin';

const KEY = 'nearplace:adminToken:v1';

type Tab = 'establishments' | 'events' | 'userEvents';

export default function AdminUserDetailsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const params = useLocalSearchParams();
  const userId = String((params as any)?.id || '').trim();

  const [token, setToken] = useState('');
  const effectiveToken = String(token || '').trim() || undefined;
  const [tab, setTab] = useState<Tab>('establishments');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setToken(String(v || '')));
  }, []);

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 15,
    retry: false,
  });
  const isAdminRole = String((me as any)?.role || '') === 'admin';
  const hasAccess = isAdminRole || !!effectiveToken;

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin-user-details', userId, effectiveToken || 'session'],
    enabled: hasAccess && !!userId,
    queryFn: () => fetchAdminUserDetails(userId, { token: effectiveToken, perTypeLimit: 200 }),
    staleTime: 1000 * 10,
    retry: false,
  });

  const u = (data as any)?.user || {};
  const profile = (data as any)?.establishmentProfile || null;
  const establishments = useMemo(() => ((data as any)?.establishments || []) as any[], [data]);
  const events = useMemo(() => ((data as any)?.events || []) as any[], [data]);
  const userEvents = useMemo(() => ((data as any)?.userEvents || []) as any[], [data]);

  const fmtDate = (d: any) => {
    try {
      if (!d) return '—';
      const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
      if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '—';
      return dt.toLocaleString();
    } catch {
      return '—';
    }
  };

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['admin-user-details', userId] }).catch(() => {});
      await qc.invalidateQueries({ queryKey: ['admin-users-content'] }).catch(() => {});
      await qc.invalidateQueries({ queryKey: ['admin-pending', 'moderation'] }).catch(() => {});
      void refetch();
    } catch (e: any) {
      Alert.alert('Admin', String(e?.response?.data?.message || e?.message || 'Erreur'));
    }
  };

  const errText = error ? String((error as any)?.response?.data?.message || (error as any)?.message || error) : null;

  const confirmDelete = async (label: string, fn: () => void) => {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert('Supprimer', `Supprimer définitivement: ${label} ?`, [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    fn();
  };

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <TouchableOpacity
      onPress={() => setTab(id)}
      style={[
        styles.tabBtn,
        {
          backgroundColor: tab === id ? t.primary : t.input,
          borderColor: tab === id ? t.primary : t.border,
        },
      ]}
    >
      <Text style={{ color: tab === id ? '#fff' : t.text, fontWeight: '900' }}>{label}</Text>
    </TouchableOpacity>
  );

  const renderThumbs = (urls: any[]) => {
    const photos = (Array.isArray(urls) ? urls : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10);
    if (photos.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        {photos.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => Alert.alert('Photo', p)}
            style={{ width: 74, height: 74, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.06)' }}
          >
            <Image source={{ uri: p }} style={{ width: '100%', height: '100%' }} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            Admin • Utilisateur
          </Text>
          <Text style={[styles.sub, { color: t.muted }]} numberOfLines={1}>
            {u.username || u.email || userId || '—'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.refresh, { borderColor: t.border, backgroundColor: t.input }]} onPress={() => refetch()} disabled={isLoading}>
          <Text style={{ color: t.text, fontWeight: '900' }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {!hasAccess ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Accès admin requis</Text>
            <Text style={[styles.cardText, { color: t.muted }]}>Connecte-toi en admin ou renseigne ADMIN_TOKEN.</Text>
          </View>
        ) : null}

        {!!errText ? (
          <View style={[styles.card, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={[styles.cardTitle, { color: '#b91c1c' }]}>Erreur</Text>
            <Text style={[styles.cardText, { color: '#b91c1c' }]}>{errText}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Infos utilisateur</Text>
          {isLoading ? <Text style={[styles.cardText, { color: t.muted }]}>Chargement…</Text> : null}
          {!isLoading && !errText && !data ? (
            <Text style={[styles.cardText, { color: '#b91c1c' }]}>
              Données non reçues. Vérifie que le backend renvoie du JSON (pas du HTML) et que la route est déployée.
            </Text>
          ) : null}
          {!isLoading ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                {u.username || '—'}
              </Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>id: {String(u.id || '—')}</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>email: {String(u.email || '—')}</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>rôle: {String(u.role || 'user')}</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>créé: {fmtDate(u.createdAt)}</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>
                mail vérifié: {String(u.emailVerified !== false)} • profil complété: {String(!!u.profileCompleted)}
              </Text>
            </View>
          ) : null}
        </View>

        {profile ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Profil établissement</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {!!profile.avatarUrl ? (
                <Image
                  source={{ uri: String(profile.avatarUrl) }}
                  style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)' }}
                />
              ) : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                  {profile.name || '—'}
                </Text>
                <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={2}>
                  {profile.category || '—'} • {profile.address || '—'}
                </Text>
                <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={1}>
                  tel: {profile.phone || '—'}
                </Text>
              </View>
            </View>
            {!!profile.description ? (
              <Text style={{ color: t.muted, marginTop: 10 }} numberOfLines={8}>
                {String(profile.description)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <TabBtn id="establishments" label={`Établissements (${establishments.length})`} />
          <TabBtn id="events" label={`Events (${events.length})`} />
          <TabBtn id="userEvents" label={`Soirées (${userEvents.length})`} />
        </View>

        {tab === 'establishments' ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Établissements (gérables)</Text>
            <Text style={[styles.cardText, { color: t.muted }]}>Ici on affiche uniquement les lieux appartenant à cet utilisateur (pas les importés).</Text>
            {establishments.length === 0 ? <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text> : null}
            {establishments.map((est: any) => {
              const thumb = String((est?.photos || [])?.[0] || '').trim();
              const published = !!est?.published;
              return (
                <View key={String(est?.id)} style={[styles.rowCard, { borderColor: t.border }]}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {!!thumb ? (
                      <Image
                        source={{ uri: thumb }}
                        style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.06)' }}
                      />
                    ) : (
                      <View style={[styles.thumbFallback, { backgroundColor: t.input, borderColor: t.border }]} />
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                        {est?.name || '—'}
                      </Text>
                      <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={2}>
                        {est?.category || '—'} • {est?.commune || est?.address || '—'}
                      </Text>
                      {!!est?.phone ? <Text style={{ color: t.muted, fontWeight: '800' }}>tel: {String(est.phone)}</Text> : null}
                      <Text style={{ color: t.muted }} numberOfLines={2}>
                        publié: {String(published)} • créé: {fmtDate(est?.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {!!est?.description ? (
                    <Text style={{ color: t.muted, marginTop: 10 }} numberOfLines={10}>
                      {String(est.description)}
                    </Text>
                  ) : null}
                  {renderThumbs(est?.photos || [])}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {!published ? (
                      <>
                        <TouchableOpacity
                          style={[styles.pillOk, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                          onPress={() => act(() => approveEstablishment(String(est?.id), effectiveToken))}
                        >
                          <Text style={{ color: '#22c55e', fontWeight: '900' }}>Approuver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                          onPress={() =>
                            confirmDelete(String(est?.name || 'Établissement'), () => act(() => rejectEstablishment(String(est?.id), effectiveToken)))
                          }
                        >
                          <Text style={{ color: '#ef4444', fontWeight: '900' }}>Rejeter</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)', marginLeft: 'auto' }]}
                      onPress={() =>
                        confirmDelete(String(est?.name || 'Établissement'), () =>
                          act(() => deleteEstablishment(String(est?.id), effectiveToken)),
                        )
                      }
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '900' }}>🗑 Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'events' ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Événements (pro)</Text>
            {events.length === 0 ? <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text> : null}
            {events.map((ev: any) => {
              const published = !!ev?.published;
              return (
                <View key={String(ev?.id)} style={[styles.rowCard, { borderColor: t.border }]}>
                  <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                    {ev?.title || '—'}
                  </Text>
                  <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={2}>
                    {ev?.category || 'event'} • {fmtDate(ev?.startsAt)}
                  </Text>
                  {!!ev?.endsAt ? <Text style={{ color: t.muted }}>fin: {fmtDate(ev.endsAt)}</Text> : null}
                  {!!ev?.establishmentId ? <Text style={{ color: t.muted }}>establishmentId: {String(ev.establishmentId)}</Text> : null}
                  {!!ev?.description ? (
                    <Text style={{ color: t.muted, marginTop: 8 }} numberOfLines={10}>
                      {String(ev.description)}
                    </Text>
                  ) : null}
                  {renderThumbs([ev?.coverUrl, ...(ev?.photos || [])].filter(Boolean))}
                  <Text style={{ color: t.muted }}>
                    publié: {String(published)} • modération: {String(ev?.moderationStatus || '—')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {!published ? (
                      <>
                        <TouchableOpacity
                          style={[styles.pillOk, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                          onPress={() => act(() => approveProEvent(String(ev?.id), effectiveToken))}
                        >
                          <Text style={{ color: '#22c55e', fontWeight: '900' }}>Approuver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                          onPress={() =>
                            confirmDelete(String(ev?.title || 'Event'), () => act(() => rejectProEvent(String(ev?.id), effectiveToken)))
                          }
                        >
                          <Text style={{ color: '#ef4444', fontWeight: '900' }}>Rejeter</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)', marginLeft: 'auto' }]}
                      onPress={() => confirmDelete(String(ev?.title || 'Event'), () => act(() => deleteProEvent(String(ev?.id), effectiveToken)))}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '900' }}>🗑 Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'userEvents' ? (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Soirées (users)</Text>
            {userEvents.length === 0 ? <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text> : null}
            {userEvents.map((ue: any) => {
              const published = !!ue?.published;
              return (
                <View key={String(ue?.id)} style={[styles.rowCard, { borderColor: t.border }]}>
                  <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                    {ue?.title || '—'}
                  </Text>
                  <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={2}>
                    {ue?.kind || 'party'} • {fmtDate(ue?.startsAt)}
                  </Text>
                  {!!ue?.endsAt ? <Text style={{ color: t.muted }}>fin: {fmtDate(ue.endsAt)}</Text> : null}
                  {ue?.ageMin != null ? <Text style={{ color: t.muted }}>âge min: {String(ue.ageMin)}</Text> : null}
                  {!!ue?.description ? (
                    <Text style={{ color: t.muted, marginTop: 8 }} numberOfLines={10}>
                      {String(ue.description)}
                    </Text>
                  ) : null}
                  {renderThumbs(ue?.photos || [])}
                  <Text style={{ color: t.muted }}>
                    publié: {String(published)} • modération: {String(ue?.moderationStatus || '—')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {!published ? (
                      <>
                        <TouchableOpacity
                          style={[styles.pillOk, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                          onPress={() => act(() => approveUserEvent(String(ue?.id), effectiveToken))}
                        >
                          <Text style={{ color: '#22c55e', fontWeight: '900' }}>Approuver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                          onPress={() =>
                            confirmDelete(String(ue?.title || 'Soirée'), () => act(() => rejectUserEvent(String(ue?.id), effectiveToken)))
                          }
                        >
                          <Text style={{ color: '#ef4444', fontWeight: '900' }}>Rejeter</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.pillBad, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)', marginLeft: 'auto' }]}
                      onPress={() => confirmDelete(String(ue?.title || 'Soirée'), () => act(() => deleteUserEvent(String(ue?.id), effectiveToken)))}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '900' }}>🗑 Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backText: { fontWeight: '900', fontSize: 18 },
  title: { fontWeight: '900', fontSize: 16 },
  sub: { marginTop: 4, fontWeight: '800', fontSize: 12 },
  refresh: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  cardTitle: { fontWeight: '900', fontSize: 14 },
  cardText: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  tabBtn: { flex: 1, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  rowCard: { borderTopWidth: 1, paddingTop: 12, marginTop: 12, gap: 8 },
  thumbFallback: { width: 56, height: 56, borderRadius: 14, borderWidth: 1 },
  pillOk: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  pillBad: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});


