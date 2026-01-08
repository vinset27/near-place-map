import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authMe } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';

type Item = { title: string; subtitle: string; route: string; requireRole?: 'admin' | 'establishment'; requireProfile?: boolean; requireAuth?: boolean };

export default function BusinessMenuScreen() {
  const router = useRouter();
  const t = useAppTheme();

  const { data: me } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const isAuthed = !!me;
  const role = String((me as any)?.role || 'user');
  const isAdmin = role === 'admin';
  const isEstablishment = role === 'establishment';
  const isProfileCompleted = !!(me as any)?.profileCompleted;

  const items = useMemo<Item[]>(
    () => [
      { title: 'Dashboard Pro', subtitle: 'Stats, vues, visiteurs', route: '/business-dashboard', requireRole: 'establishment', requireProfile: true, requireAuth: true },
      { title: 'Profil établissement', subtitle: 'Photo, description, localisation', route: '/profile-establishment', requireAuth: true },
      { title: 'Créer un évènement', subtitle: 'En attente de validation admin', route: '/event-create', requireRole: 'establishment', requireProfile: true, requireAuth: true },
      { title: 'Mes soirées', subtitle: 'Soirées & rencontres', route: '/user-events-my', requireAuth: true },
      { title: 'Mes trajets', subtitle: 'Historique', route: '/trips', requireAuth: true },
      { title: 'Ajouter un lieu', subtitle: 'Depuis la carte (validation admin)', route: '/map', requireAuth: true },
      ...(isAdmin ? ([{ title: 'Admin', subtitle: 'Valider / refuser', route: '/admin', requireAuth: true }] as Item[]) : []),
      { title: 'Paramètres', subtitle: 'Compte, sécurité, aide', route: '/settings', requireAuth: false },
    ],
    [isAdmin],
  );

  const canOpen = (it: Item): { ok: boolean; reason?: string } => {
    if (it.requireAuth && !isAuthed) return { ok: false, reason: 'Connecte-toi d’abord.' };
    if (it.requireRole === 'admin' && !isAdmin) return { ok: false, reason: 'Accès admin uniquement.' };
    if (it.requireRole === 'establishment' && !isEstablishment) return { ok: false, reason: 'Compte établissement requis.' };
    if (it.requireProfile && !isProfileCompleted) return { ok: false, reason: 'Complète ton profil établissement.' };
    return { ok: true };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={[styles.title, { color: t.text }]}>Espace</Text>
        <Text style={[styles.sub, { color: t.muted }]}>
          {isAdmin ? 'Admin' : isEstablishment ? (isProfileCompleted ? 'Compte établissement' : 'Compte établissement (profil à compléter)') : 'Compte utilisateur'}
        </Text>

        {!isAuthed && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Connexion requise</Text>
            <Text style={[styles.cardSub, { color: t.muted }]}>Connecte-toi pour gérer tes contenus.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.primary, flex: 1 }]} onPress={() => router.push('/login')}>
                <Text style={styles.btnText}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: t.input, borderColor: t.border, borderWidth: 1, flex: 1 }]} onPress={() => router.push('/register')}>
                <Text style={[styles.btnText, { color: t.text }]}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ marginTop: 12, gap: 10 }}>
          {items.map((it) => {
            const decision = canOpen(it);
            return (
              <TouchableOpacity
                key={it.title}
                activeOpacity={0.9}
                onPress={() => {
                  if (!decision.ok) {
                    if (!isAuthed) return router.push('/login');
                    if (!isProfileCompleted && isEstablishment) return router.push('/profile-establishment');
                    return;
                  }
                  if (it.route === '/settings') {
                    return router.push({ pathname: '/settings', params: { backTo: '/(app)/business' } } as any);
                  }
                  router.push(it.route as any);
                }}
                style={[
                  styles.card,
                  {
                    backgroundColor: t.card,
                    borderColor: t.border,
                    opacity: decision.ok ? 1 : 0.6,
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: t.text }]}>{it.title}</Text>
                <Text style={[styles.cardSub, { color: decision.ok ? t.muted : '#ef4444' }]}>
                  {decision.ok ? it.subtitle : decision.reason}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '900' },
  sub: { marginTop: 4, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardTitle: { fontWeight: '900', fontSize: 14 },
  cardSub: { marginTop: 6, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  btn: { paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900' },
});



