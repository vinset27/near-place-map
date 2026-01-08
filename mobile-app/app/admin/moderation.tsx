import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { authMe } from '../../services/auth';
import api, { API_BASE_URL } from '../../services/api';
import {
  approveEstablishment,
  approveProEvent,
  approveUserEvent,
  deleteEstablishment,
  deleteProEvent,
  deleteUserEvent,
  fetchPendingModeration,
  fetchAdminUsersWithContent,
  rejectEstablishment,
  rejectProEvent,
  rejectUserEvent,
} from '../../services/admin';

const KEY = 'nearplace:adminToken:v1';

export default function AdminModerationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();

  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      const val = String(v || '');
      setToken(val);
      setTokenInput(val);
    });
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

  const hasAccess = isAdminRole || !!effectiveToken;

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin-pending', 'moderation', effectiveToken || 'session'],
    enabled: hasAccess,
    queryFn: () => fetchPendingModeration({ token: effectiveToken, limit: 200, includePublished: true }),
    staleTime: 1000 * 5,
    retry: false,
  });

  const pendingEsts = useMemo(() => (data as any)?.pending?.establishments || [], [data]);
  const pendingEvents = useMemo(() => (data as any)?.pending?.events || [], [data]);
  const pendingUserEvents = useMemo(() => (data as any)?.pending?.userEvents || [], [data]);
  const publishedEsts = useMemo(() => (data as any)?.published?.establishments || [], [data]);
  const publishedEvents = useMemo(() => (data as any)?.published?.events || [], [data]);
  const publishedUserEvents = useMemo(() => (data as any)?.published?.userEvents || [], [data]);

  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users-content', effectiveToken || 'session'],
    enabled: hasAccess,
    queryFn: () => fetchAdminUsersWithContent({ token: effectiveToken, limit: 200, perUserLimit: 30 }),
    staleTime: 1000 * 10,
    retry: false,
  });
  const usersList = useMemo(() => (usersData as any)?.users || [], [usersData]);

  const saveToken = async () => {
    const val = String(tokenInput || '').trim();
    setToken(val);
    await AsyncStorage.setItem(KEY, val).catch(() => {});
    setToast(val ? 'Token sauvegardé.' : 'Token supprimé.');
    await qc.invalidateQueries({ queryKey: ['admin-pending', 'moderation'] }).catch(() => {});
    void refetch();
  };

  const headerInfo = !isAdminRole && !effectiveToken ? 'Connecte-toi en admin ou colle ton ADMIN_TOKEN' : 'Modération des contenus';
  const errText = error ? String((error as any)?.response?.data?.message || (error as any)?.message || error) : null;

  const openUser = (id: string) => {
    const safe = String(id || '').trim();
    if (!safe) return;
    router.push(`/admin/users/${encodeURIComponent(safe)}`);
  };

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setToast('OK');
      await qc.invalidateQueries({ queryKey: ['admin-pending', 'moderation'] }).catch(() => {});
    } catch (e: any) {
      Alert.alert('Admin', String(e?.response?.data?.message || e?.message || 'Erreur'));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>Admin • Modération</Text>
          <Text style={[styles.sub, { color: t.muted }]} numberOfLines={1}>
            {headerInfo}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refresh, { borderColor: t.border, backgroundColor: t.input }]}
          onPress={() => {
            refetch();
            refetchUsers();
          }}
          disabled={isLoading}
        >
          <Text style={{ color: t.text, fontWeight: '900' }}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {!!toast && (
          <View style={[styles.toast, { backgroundColor: t.input, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '900' }}>{toast}</Text>
          </View>
        )}

        {!hasAccess && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Accès admin requis</Text>
            <Text style={[styles.cardText, { color: t.muted }]}>Connecte-toi en admin ou renseigne ADMIN_TOKEN.</Text>
          </View>
        )}

        {!!errText && (
          <View style={[styles.card, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={[styles.cardTitle, { color: '#b91c1c' }]}>Erreur</Text>
            <Text style={[styles.cardText, { color: '#b91c1c' }]}>{errText}</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Diagnostic</Text>
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: t.input, borderColor: t.border }]}
              onPress={() => setShowDiagnostic((v) => !v)}
            >
              <Text style={{ color: t.text, fontWeight: '900' }}>{showDiagnostic ? 'Masquer' : 'Afficher'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.cardText, { color: t.muted }]}>
            Accès: {hasAccess ? 'OK' : 'NON'} • roleAdmin: {String(isAdminRole)} • token: {effectiveToken ? 'oui' : 'non'}
          </Text>
          <Text style={[styles.cardText, { color: t.muted }]}>
            Users: {usersList.length} • Pending: {pendingEsts.length + pendingEvents.length + pendingUserEvents.length} • Publiés:{' '}
            {publishedEsts.length + publishedEvents.length + publishedUserEvents.length}
          </Text>
          {showDiagnostic ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={[styles.cardText, { color: t.muted }]}>API_BASE_URL: {String(API_BASE_URL)}</Text>
              <Text style={[styles.cardText, { color: t.muted }]}>api.defaults.baseURL: {String((api.defaults as any)?.baseURL || '')}</Text>
              <Text style={[styles.cardText, { color: t.muted }]} numberOfLines={10}>
                moderation payload: {String(JSON.stringify(data || {}).slice(0, 1200))}
              </Text>
              <Text style={[styles.cardText, { color: t.muted }]} numberOfLines={10}>
                users payload: {String(JSON.stringify(usersData || {}).slice(0, 1200))}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Utilisateurs & publications</Text>
          {usersLoading ? <Text style={[styles.cardText, { color: t.muted }]}>Chargement…</Text> : null}
          {!!usersError ? (
            <Text style={[styles.cardText, { color: '#b91c1c' }]}>
              {String((usersError as any)?.response?.data?.message || (usersError as any)?.message || usersError)}
            </Text>
          ) : null}
          {usersList.length === 0 && !usersLoading ? <Text style={[styles.cardText, { color: t.muted }]}>— Aucun utilisateur</Text> : null}

          {usersList.slice(0, 150).map((entry: any, idx: number) => {
            const u = entry.user || {};
            const uid = String(u.id || u.username || u.email || `u-${idx}`);
            const countEst = entry.counts?.establishments ?? 0;
            const countEv = entry.counts?.events ?? 0;
            const countUe = entry.counts?.userEvents ?? 0;

            return (
              <View key={uid} style={[styles.userCard, { borderColor: t.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                      {u.username || u.email || u.id || 'Utilisateur'}
                    </Text>
                    <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={1}>
                      {u.email || '—'} • rôle: {u.role || 'user'}
                      {u.emailVerified === false ? ' • mail non vérifié' : ''}
                    </Text>
                    <Text style={{ color: t.muted, fontWeight: '800' }} numberOfLines={1}>
                      Lieux: {countEst} • Events: {countEv} • Soirées: {countUe}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: t.input, borderColor: t.border }]}
                    onPress={() => openUser(String(u.id || ''))}
                  >
                    <Text style={{ color: t.text, fontWeight: '900' }}>Ouvrir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>ADMIN_TOKEN (optionnel)</Text>
          <TextInput
            placeholder="x-admin-token…"
            placeholderTextColor={t.muted}
            value={tokenInput}
            onChangeText={setTokenInput}
            style={[
              styles.input,
              {
                backgroundColor: t.input,
                borderColor: t.border,
                color: t.text,
                marginTop: 6,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={[styles.primary, { backgroundColor: t.primary, flex: 1 }]} onPress={saveToken}>
              <Text style={styles.primaryText}>Sauvegarder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghost, { backgroundColor: t.input, borderColor: t.border }]}
              onPress={async () => {
                setToken('');
                setTokenInput('');
                await AsyncStorage.removeItem(KEY).catch(() => {});
                setToast('Token supprimé.');
                await qc.invalidateQueries({ queryKey: ['admin-pending', 'moderation'] }).catch(() => {});
              }}
            >
              <Text style={[styles.ghostText, { color: t.text }]}>X</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ModerationSection
          title="En attente"
          loading={isLoading}
          t={t}
          ests={pendingEsts}
          events={pendingEvents}
          userEvents={pendingUserEvents}
          onApprove={(kind, id) =>
            act(() =>
              kind === 'est'
                ? approveEstablishment(id, effectiveToken)
                : kind === 'ev'
                  ? approveProEvent(id, effectiveToken)
                  : approveUserEvent(id, effectiveToken),
            )
          }
          onReject={(kind, id) =>
            act(() =>
              kind === 'est'
                ? rejectEstablishment(id, effectiveToken)
                : kind === 'ev'
                  ? rejectProEvent(id, effectiveToken)
                  : rejectUserEvent(id, effectiveToken),
            )
          }
          onDelete={null}
        />

        <ModerationSection
          title="Publié récemment"
          loading={isLoading}
          t={t}
          ests={publishedEsts}
          events={publishedEvents}
          userEvents={publishedUserEvents}
          onApprove={null}
          onReject={null}
          onDelete={(kind, id) =>
            act(() =>
              kind === 'est'
                ? deleteEstablishment(id, effectiveToken)
                : kind === 'ev'
                  ? deleteProEvent(id, effectiveToken)
                  : deleteUserEvent(id, effectiveToken),
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type ModerationSectionProps = {
  title: string;
  loading: boolean;
  t: ReturnType<typeof useAppTheme>;
  ests: any[];
  events: any[];
  userEvents: any[];
  onApprove: null | ((kind: 'est' | 'ev' | 'ue', id: string) => void);
  onReject: null | ((kind: 'est' | 'ev' | 'ue', id: string) => void);
  onDelete: null | ((kind: 'est' | 'ev' | 'ue', id: string) => void);
};

function ModerationSection({ title, loading, t, ests, events, userEvents, onApprove, onReject, onDelete }: ModerationSectionProps) {
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.cardTitle, { color: t.text }]}>{title}</Text>
      {loading ? <Text style={[styles.cardText, { color: t.muted }]}>Chargement…</Text> : null}

      <Block
        label="Établissements"
        t={t}
        items={ests}
        render={(est: any) => ({
          id: String(est.id),
          title: String(est.name || '—'),
          subtitle: `${est.category || '—'} • ${est.commune || est.address || '—'} • ${est.owner?.name || '—'}`,
          description: est.description,
        })}
        onApprove={onApprove ? (id) => onApprove('est', id) : null}
        onReject={onReject ? (id) => onReject('est', id) : null}
        onDelete={onDelete ? (id) => onDelete('est', id) : null}
      />

      <Block
        label="Événements établissements"
        t={t}
        items={events}
        render={(ev: any) => ({
          id: String(ev.id),
          title: String(ev.title || '—'),
          subtitle: `${ev.category || 'event'} • ${new Date(ev.startsAt).toLocaleString()} • ${ev.organizer?.name || '—'}`,
          description: ev.description,
        })}
        onApprove={onApprove ? (id) => onApprove('ev', id) : null}
        onReject={onReject ? (id) => onReject('ev', id) : null}
        onDelete={onDelete ? (id) => onDelete('ev', id) : null}
      />

      <Block
        label="Soirées users"
        t={t}
        items={userEvents}
        render={(ue: any) => ({
          id: String(ue.id),
          title: String(ue.title || '—'),
          subtitle: `${ue.kind || 'party'} • ${new Date(ue.startsAt).toLocaleString()} • ${ue.organizer?.name || '—'}`,
          description: ue.description,
        })}
        onApprove={onApprove ? (id) => onApprove('ue', id) : null}
        onReject={onReject ? (id) => onReject('ue', id) : null}
        onDelete={onDelete ? (id) => onDelete('ue', id) : null}
      />
    </View>
  );
}

type BlockProps = {
  label: string;
  t: ReturnType<typeof useAppTheme>;
  items: any[];
  render: (item: any) => { id: string; title: string; subtitle?: string; description?: string | null };
  onApprove: null | ((id: string) => void);
  onReject: null | ((id: string) => void);
  onDelete: null | ((id: string) => void);
};

function Block({ label, t, items, render, onApprove, onReject, onDelete }: BlockProps) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.kicker, { color: t.muted }]}>{label}</Text>
      {items.length === 0 ? (
        <Text style={[styles.cardText, { color: t.muted }]}>— Aucun</Text>
      ) : (
        items.slice(0, 120).map((raw) => {
          const { id, title, subtitle, description } = render(raw);
          return (
            <View key={id} style={[styles.row, { borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '900' }} numberOfLines={1}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>
                    {subtitle}
                  </Text>
                )}
                {!!description && (
                  <Text style={{ color: t.muted, marginTop: 6 }} numberOfLines={4}>
                    {description}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                {onApprove && (
                  <TouchableOpacity
                    style={[styles.approve, { backgroundColor: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.30)' }]}
                    onPress={() => onApprove(id)}
                  >
                    <Text style={{ color: '#22c55e', fontWeight: '900' }}>✓</Text>
                  </TouchableOpacity>
                )}
                {onReject && (
                  <TouchableOpacity
                    style={[styles.reject, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                    onPress={() => onReject(id)}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '900' }}>✕</Text>
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity
                    style={[styles.reject, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.26)' }]}
                    onPress={async () => {
                      const ok = await new Promise<boolean>((resolve) => {
                        Alert.alert('Supprimer', 'Supprimer définitivement ?', [
                          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
                          { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
                        ]);
                      });
                      if (!ok) return;
                      onDelete(id);
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '900' }}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
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
  toast: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  cardTitle: { fontWeight: '900', fontSize: 14 },
  cardText: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, fontWeight: '800' },
  primary: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontWeight: '900' },
  ghost: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, paddingHorizontal: 14 },
  ghostText: { fontWeight: '900' },
  kicker: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  approve: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reject: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  userCard: { borderTopWidth: 1, paddingTop: 10, marginTop: 12, width: '100%' },
  pillBtn: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});


