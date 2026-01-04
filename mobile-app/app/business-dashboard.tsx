import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authLogout, authMe } from '../services/auth';
import { PlaceImage } from '../components/UI/PlaceImage';
import { useCurrentLocation } from '../stores/useLocationStore';
import { useLocationStore } from '../stores/useLocationStore';
import { useStableQueryOrigin } from '../services/queryOrigin';
import { fetchMyBusinessApplications, fetchMyEstablishments } from '../services/pro';
import { fetchMyEvents } from '../services/events';
import { fetchProStats } from '../services/analytics';

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const userLocation = useCurrentLocation();
  const rawUserLocation = useLocationStore((s) => s.userLocation);
  const hasPermission = useLocationStore((s) => s.hasPermission);
  const origin = useStableQueryOrigin(userLocation);

  const { data: me, error: meError } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });
  const isAuthed = !!me && !meError;
  const isEstablishment = !!me && (me as any)?.role === 'establishment' && !!(me as any)?.profileCompleted;
  const isBackendError = !!meError && (meError as any)?.response?.status !== 401;
  const isEmailVerified = !!me && (me as any)?.emailVerified !== false;

  // Centralize verification UI on /verify-email only.
  useEffect(() => {
    if (isAuthed && !isEmailVerified) {
      router.replace('/verify-email');
    }
  }, [isAuthed, isEmailVerified, router]);

  const canQuery = !hasPermission || !!rawUserLocation;

  const { data: myApps } = useQuery({
    queryKey: ['pro-my-applications'],
    enabled: isAuthed,
    queryFn: () => fetchMyBusinessApplications(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const { data: myEsts, error: myEstsError } = useQuery({
    queryKey: ['pro-my-establishments'],
    enabled: isAuthed && isEstablishment,
    queryFn: () => fetchMyEstablishments(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const { data: myEvents } = useQuery({
    queryKey: ['pro-my-events'],
    enabled: isAuthed && isEstablishment,
    queryFn: () => fetchMyEvents(),
    staleTime: 1000 * 10,
    retry: false,
  });

  const { data: proStats } = useQuery({
    queryKey: ['pro-stats'],
    enabled: isAuthed && isEstablishment,
    queryFn: () => fetchProStats(),
    staleTime: 1000 * 30,
    retry: false,
  });

  const stats = useMemo(() => {
    const apps = myApps?.length || 0;
    const ests = myEsts?.length || 0;
    const evs = myEvents?.length || 0;
    return { apps, ests, evs };
  }, [myApps, myEsts, myEvents]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0b1220', '#0b2a6b', '#2563eb']} style={styles.bg}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>O'Show • Pro</Text>
              <Text style={styles.title}>Dashboard</Text>
            </View>
          </View>

          <Text style={styles.sub}>Vitrine, établissement, évènements & statistiques.</Text>

          {isBackendError && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Backend indisponible</Text>
              <Text style={styles.cardText}>Ton API ne répond pas (cold start / DNS / Cloudflare). Attends 20-30s puis réessaie.</Text>
              <Text style={[styles.cardText, { opacity: 0.8 }]} numberOfLines={2}>
                {String((meError as any)?.message || meError)}
              </Text>
              <TouchableOpacity
                style={[styles.secondarySmall, { alignSelf: 'flex-start' }]}
                onPress={async () => {
                  await qc.invalidateQueries({ queryKey: ['auth-me'] });
                }}
              >
                <Text style={styles.secondarySmallText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isAuthed && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Compte requis</Text>
              <Text style={styles.cardText}>Créez un compte ou connectez-vous pour soumettre un établissement.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.primary, { flex: 1 }]} onPress={() => router.push('/register')}>
                  <Text style={styles.primaryText}>Créer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondarySmall, { flex: 1 }]} onPress={() => router.push('/login')}>
                  <Text style={styles.secondarySmallText}>Connexion</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isAuthed && !isEmailVerified && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Email non vérifié</Text>
              <Text style={styles.cardText}>Redirection vers la page de vérification…</Text>
            </View>
          )}

          {isAuthed && isEmailVerified && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.ests}</Text>
                <Text style={styles.statLabel}>Établissements</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.evs}</Text>
                <Text style={styles.statLabel}>Évènements</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.apps}</Text>
                <Text style={styles.statLabel}>Demandes</Text>
              </View>
            </View>
          )}

          {isAuthed && isEstablishment && !!proStats && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Statistiques</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{proStats.range7d.views}</Text>
                  <Text style={styles.statLabel}>Vues (7j)</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{proStats.range7d.visitors}</Text>
                  <Text style={styles.statLabel}>Visiteurs (7j)</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{proStats.range30d.views}</Text>
                  <Text style={styles.statLabel}>Vues (30j)</Text>
                </View>
              </View>

              {proStats.topEstablishments?.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Top établissements (30j)</Text>
                  <View style={{ gap: 10 }}>
                    {proStats.topEstablishments.slice(0, 5).map((e) => (
                      <TouchableOpacity key={e.id} style={styles.rowCard} onPress={() => router.push(`/establishment/${e.id}`)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {e.name || '—'}
                          </Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {e.views} vues • {e.visitors} visiteurs
                          </Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Voir</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Établissement</Text>
            {isAuthed && !isEmailVerified && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Email non vérifié</Text>
                <Text style={styles.cardText}>Redirection vers la page de vérification…</Text>
              </View>
            )}
            {isAuthed && !isEstablishment && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Activer le compte établissement</Text>
                <Text style={styles.cardText}>
                  Complétez le profil (photo, catégorie, réseaux) pour pouvoir publier et gérer vos contenus.
                </Text>
                <TouchableOpacity style={styles.primary} onPress={() => router.push('/profile-establishment')}>
                  <Text style={styles.primaryText}>Configurer</Text>
                </TouchableOpacity>
              </View>
            )}
            {isAuthed && isEstablishment && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Déclarer un établissement</Text>
                <Text style={styles.cardText}>Position, photos, infos. Validation admin obligatoire.</Text>
                <TouchableOpacity style={styles.primary} onPress={() => router.push('/business-apply')}>
                  <Text style={styles.primaryText}>Nouvelle demande</Text>
                </TouchableOpacity>
              </View>
            )}

            {isAuthed && myApps && myApps.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mes demandes</Text>
                <Text style={styles.cardText}>
                  {myApps[0].name} • statut: {String((myApps[0] as any).status || 'pending')}
                </Text>
              </View>
            )}

            {isAuthed && isEstablishment && myEsts && myEsts.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mes établissements</Text>
                <Text style={styles.cardText}>{myEsts.length} établissement(s) publié(s) / relié(s) à votre compte.</Text>
                <View style={{ height: 10 }} />
                <FlatList
                  data={myEsts.slice(0, 8) as any}
                  keyExtractor={(x: any) => String(x.id)}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  renderItem={({ item }: any) => {
                    const cover = (item?.photos && item.photos.length ? item.photos[0] : null) || item?.imageUrl || null;
                    return (
                      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/establishment/${String(item.id)}`)} style={styles.rowCard}>
                        <PlaceImage
                          uri={cover}
                          id={`${String(item.id)}-pro-est`}
                          name={String(item.name || '—')}
                          category={String(item.category || 'place')}
                          style={styles.rowImg}
                          textSize={20}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {String(item.name || '—')}
                          </Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {String(item.commune || item.address || '')}
                          </Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Gérer</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            )}

            {isAuthed && isEstablishment && !!myEstsError && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Mes établissements indisponibles</Text>
                <Text style={styles.cardText}>L’API a renvoyé une erreur (souvent 502 au réveil Render). Réessaie dans 10–20s.</Text>
                <Text style={[styles.cardText, { opacity: 0.85 }]} numberOfLines={2}>
                  {String((myEstsError as any)?.message || myEstsError)}
                </Text>
                <TouchableOpacity
                  style={[styles.secondarySmall, { alignSelf: 'flex-start' }]}
                  onPress={async () => {
                    await qc.invalidateQueries({ queryKey: ['pro-my-establishments'] });
                  }}
                >
                  <Text style={styles.secondarySmallText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Évènements</Text>
              <TouchableOpacity
                style={styles.secondarySmall}
                onPress={() => (!isAuthed ? router.push('/login') : !isEmailVerified ? undefined : !isEstablishment ? router.push('/profile-establishment') : router.push('/event-create'))}
              >
                <Text style={styles.secondarySmallText}>＋ Créer</Text>
              </TouchableOpacity>
            </View>

            {!isAuthed || !isEstablishment || !myEvents || myEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucun évènement pour l’instant</Text>
                <Text style={styles.emptyText}>Créez votre premier évènement et il apparaîtra dans l’onglet Événements.</Text>
              </View>
            ) : (
              <FlatList
                data={myEvents as any}
                keyExtractor={(e: any) => e.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }: any) => {
                  const est = item.establishment || (myEsts || []).find((x: any) => String(x.id) === String(item.establishmentId));
                  const cover = (est?.photos && est.photos.length ? est.photos[0] : null) || est?.imageUrl || null;
                  const orgName = item?.organizer?.name || est?.name || 'Organisateur';
                  const orgAvatar = item?.organizer?.avatarUrl || cover;
                  return (
                    <View style={styles.evRow}>
                      <PlaceImage
                        uri={cover}
                        id={`${String(item.id)}-pro`}
                        name={String(item.title)}
                        category={est?.category}
                        style={styles.evImg}
                        textSize={22}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.evTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.evMeta} numberOfLines={1}>
                          {String(item.category || 'event').toUpperCase()} • {new Date(item.startsAt).toLocaleString()}
                        </Text>
                        <View style={styles.evOrgRow}>
                          <View style={styles.evAvatar}>
                            <PlaceImage
                              uri={orgAvatar}
                              id={`${String(est?.id || 'est')}-mini`}
                              name={String(orgName || 'O')}
                              category={est?.category || 'organizer'}
                              style={styles.evAvatarImg}
                              textSize={14}
                            />
                          </View>
                          <Text style={styles.evOrgName} numberOfLines={1}>
                            {orgName}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>

          <Text style={styles.hint}>Astuce: seuls vos établissements et vos évènements sont visibles ici.</Text>

          {isAuthed && (
            <TouchableOpacity
              style={[styles.secondarySmall, { marginTop: 6, alignSelf: 'flex-start' }]}
              onPress={async () => {
                await authLogout().catch(() => {});
                qc.clear();
                await AsyncStorage.removeItem('nearplace:rq').catch(() => {});
                await qc.invalidateQueries({ queryKey: ['auth-me'] }).catch(() => {});
                router.replace('/map');
              }}
            >
              <Text style={styles.secondarySmallText}>Se déconnecter</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  bg: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  backText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  kicker: { color: 'rgba(255,255,255,0.78)', fontWeight: '900', letterSpacing: 0.7, fontSize: 12, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 18, maxWidth: 420 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 14, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { marginTop: 4, color: 'rgba(255,255,255,0.74)', fontWeight: '800', fontSize: 12 },
  section: { gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 16, gap: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  cardText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },
  primary: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#0b2a6b', fontWeight: '900', fontSize: 15 },
  secondarySmall: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  secondarySmallText: { color: '#fff', fontWeight: '900' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 14, gap: 6 },
  emptyTitle: { color: '#fff', fontWeight: '900' },
  emptyText: { color: 'rgba(255,255,255,0.80)', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 12 },
  evImg: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)' },
  evTitle: { color: '#fff', fontWeight: '900' },
  evMeta: { marginTop: 4, color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: 12 },
  evOrgRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  evAvatar: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  evAvatarImg: { width: 22, height: 22, borderRadius: 11 },
  evOrgName: { color: 'rgba(255,255,255,0.88)', fontWeight: '800', fontSize: 12, flex: 1 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.10)' },
  rowImg: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)' },
  rowTitle: { color: '#fff', fontWeight: '900' },
  rowMeta: { marginTop: 4, color: 'rgba(255,255,255,0.72)', fontWeight: '800', fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  hint: { paddingTop: 4, paddingBottom: 12, color: 'rgba(255,255,255,0.70)', fontSize: 12, lineHeight: 16 },
});


