import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authMe } from '../../services/auth';
import { fetchProProfile } from '../../services/pro';
import { PlaceImage } from '../../components/UI/PlaceImage';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, SearchBar, SettingsRow, SettingsSection, SkeletonRow } from '../../components/Settings/SettingsPrimitives';
import { InAppHeroHeader } from '../../components/UI/InAppHeroHeader';

type MenuItem = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  route: string;
  requireAuth?: boolean;
};

export default function BusinessScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const [q, setQ] = useState('');

  const { data: me, error: meError, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const isAuthed = !!me && !meError;
  const isBackendError = !!meError && (meError as any)?.response?.status !== 401;
  const role = String((me as any)?.role || 'user');
  const isEstablishment = role === 'establishment' && (me as any)?.profileCompleted;
  const isEstablishmentPending = role === 'establishment' && !(me as any)?.profileCompleted;
  const isAdmin = role === 'admin';

  const { data: proProfile } = useQuery({
    queryKey: ['pro-profile'],
    enabled: isAuthed,
    queryFn: () => fetchProProfile(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const contentItems: MenuItem[] = useMemo(
    () => [
      { key: 'dashboard', icon: '📊', title: 'Dashboard', subtitle: 'Statistiques, établissements, évènements', route: '/business-dashboard' },
      { key: 'profile', icon: '🏷️', title: 'Profil établissement', subtitle: 'Photo, réseaux, description, localisation', route: '/profile-establishment', requireAuth: true },
      { key: 'apply', icon: '📍', title: 'Déclarer un établissement', subtitle: 'Ajouter un lieu (validation)', route: '/business-apply', requireAuth: true },
      { key: 'event', icon: '📅', title: 'Créer un évènement', subtitle: 'Publier et attirer des visiteurs', route: '/event-create', requireAuth: true },
      { key: 'user-events', icon: '🎉', title: 'Mes soirées', subtitle: 'Soirées & points de rencontre (publics)', route: '/user-events-my', requireAuth: true },
      ...(isAdmin ? ([{ key: 'admin', icon: '🛡️', title: 'Admin', subtitle: 'Valider / refuser les publications', route: '/admin', requireAuth: true }] as any) : []),
    ],
    [isAdmin],
  );

  const settingsItems: MenuItem[] = useMemo(
    () => [
      { key: 'account', icon: '👤', title: 'Account', subtitle: 'Nom, email, téléphone, rôle, déconnexion', route: '/settings/account' },
      { key: 'notifications', icon: '🔔', title: 'Notifications', subtitle: 'Contrôle des alertes', route: '/settings/notifications' },
      { key: 'appearance', icon: '🎨', title: 'Appearance', subtitle: 'Thème, texte, densité', route: '/settings/appearance' },
      { key: 'privacy', icon: '🔒', title: 'Privacy & Security', subtitle: 'Permissions, visibilité, suppression', route: '/settings/privacy' },
      { key: 'help', icon: '🧑‍💼', title: 'Help and Support', subtitle: 'FAQ, support, feedback', route: '/settings/help' },
      { key: 'about', icon: 'ℹ️', title: 'About', subtitle: 'Version, environnement, légal', route: '/settings/about' },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { content: contentItems, settings: settingsItems };
    const match = (it: MenuItem) => `${it.title} ${it.subtitle}`.toLowerCase().includes(s);
    return {
      content: contentItems.filter(match),
      settings: settingsItems.filter(match),
    };
  }, [contentItems, q, settingsItems]);

  const displayName =
    (proProfile as any)?.name ||
    (me?.email || me?.username || 'Utilisateur');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <InAppHeroHeader
          heroImage={require('../../assets/bars.jpg')}
          title={isAdmin ? 'Espace admin' : 'Espace utilisateur'}
          subtitle={isAuthed ? (isAdmin ? 'Tous les pouvoirs' : isEstablishment ? 'Compte établissement' : 'Compte utilisateur') : 'Non connecté'}
          badgeRight={
            isEstablishment ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(11,18,32,0.06)' }}>
                <Text style={{ color: '#0b1220', fontWeight: '400', fontSize: 12 }}>🏪 Établissement</Text>
              </View>
            ) : isAdmin ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(37,99,235,0.12)' }}>
                <Text style={{ color: '#0b1220', fontWeight: '400', fontSize: 12 }}>🛡️ Admin</Text>
              </View>
            ) : isEstablishmentPending ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(37,99,235,0.10)' }}>
                <Text style={{ color: '#0b1220', fontWeight: '400', fontSize: 12 }}>🏪 À compléter</Text>
              </View>
            ) : null
          }
          avatar={
            <PlaceImage
              uri={(proProfile as any)?.avatarUrl || null}
              id="pro-avatar"
              name={displayName}
              category={isEstablishment ? 'establishment' : 'user'}
              style={{ width: 46, height: 46, borderRadius: 18 }}
              textSize={16}
            />
          }
          primaryAction={
            !isAuthed
              ? { label: 'Connexion', onPress: () => router.push('/login') }
              : { label: 'Mon compte', onPress: () => router.push('/settings/account') }
          }
          secondaryAction={
            !isAuthed ? { label: 'Créer un compte', onPress: () => router.push('/register') } : undefined
          }
        />

        {isAuthed && isEstablishmentPending && (
          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(37,99,235,0.22)', backgroundColor: 'rgba(37,99,235,0.10)', padding: 12 }}>
              <Text style={{ color: '#0b1220', fontWeight: '900' }}>Compléter votre établissement</Text>
              <Text style={{ marginTop: 4, color: 'rgba(11,18,32,0.70)', fontWeight: '700', fontSize: 12, lineHeight: 16 }}>
                Tu peux remplir le profil de ton restaurant plus tard, mais certaines fonctions Pro resteront bloquées tant que ce n’est pas complété.
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push({ pathname: '/post-register', params: { type: 'establishment' } } as any)}
                style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#0b1220' }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Compléter maintenant</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <SearchBar value={q} onChangeText={setQ} placeholder="Rechercher…" />

        {isBackendError && (
          <View style={[styles.warn, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.warnTitle, { color: t.text }]}>Backend indisponible</Text>
            <Text style={[styles.warnText, { color: t.muted }]}>Ton API ne répond pas. Attends 20–30s puis réessaie.</Text>
          </View>
        )}

        <SettingsSection title="Contenu">
          {meLoading ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : filtered.content.length === 0 ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Aucun résultat</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>Essayez un autre mot-clé.</Text>
            </View>
          ) : (
            filtered.content.map((it, idx) => (
              <React.Fragment key={it.key}>
                <SettingsRow
                  icon={it.icon}
                  title={it.title}
                  subtitle={it.subtitle}
                  onPress={() => {
                    if (it.requireAuth && !isAuthed) return router.push('/login');
                    router.push(it.route as any);
                  }}
                />
                {idx !== filtered.content.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </SettingsSection>

        <SettingsSection title="Paramètres">
          {meLoading ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : filtered.settings.length === 0 ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Aucun résultat</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>Essayez un autre mot-clé.</Text>
            </View>
          ) : (
            filtered.settings.map((it, idx) => (
              <React.Fragment key={it.key}>
                <SettingsRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.route as any)} />
                {idx !== filtered.settings.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  warn: { marginTop: 12, marginHorizontal: 14, padding: 14, borderRadius: 18, borderWidth: 1 },
  warnTitle: { fontWeight: '900', marginBottom: 6 },
  warnText: { fontWeight: '800', lineHeight: 18 },
});



