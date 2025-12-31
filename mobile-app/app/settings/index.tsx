import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { authMe } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, SearchBar, SettingsRow, SettingsScreenShell, SettingsSection, SkeletonRow } from '../../components/Settings/SettingsPrimitives';

type Item = {
  key: string;
  section: string;
  icon: string;
  title: string;
  subtitle: string;
  route: string;
};

export default function SettingsHome() {
  const router = useRouter();
  const t = useAppTheme();
  const [q, setQ] = useState('');

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const items: Item[] = useMemo(
    () => [
      {
        key: 'account',
        section: 'Account',
        icon: '👤',
        title: 'Account',
        subtitle: 'Nom, email, téléphone, rôle, mot de passe, déconnexion',
        route: '/settings/account',
      },
      {
        key: 'notifications',
        section: 'Notifications',
        icon: '🔔',
        title: 'Notifications',
        subtitle: 'Contrôlez précisément les alertes que vous recevez',
        route: '/settings/notifications',
      },
      {
        key: 'appearance',
        section: 'Appearance',
        icon: '🎨',
        title: 'Appearance',
        subtitle: 'Thème, taille du texte, densité de l’interface',
        route: '/settings/appearance',
      },
      {
        key: 'privacy',
        section: 'Privacy & Security',
        icon: '🔒',
        title: 'Privacy & Security',
        subtitle: 'Visibilité sur ce téléphone, permissions, suppression',
        route: '/settings/privacy',
      },
      {
        key: 'help',
        section: 'Help and Support',
        icon: '🧑‍💼',
        title: 'Help and Support',
        subtitle: 'FAQ, support, signalement, feedback',
        route: '/settings/help',
      },
      {
        key: 'about',
        section: 'About',
        icon: 'ℹ️',
        title: 'About',
        subtitle: 'Version, environnement, conditions & confidentialité',
        route: '/settings/about',
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => `${it.title} ${it.subtitle} ${it.section}`.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <SettingsScreenShell title="Settings">
      <SearchBar value={q} onChangeText={setQ} placeholder="Search for a setting…" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Résumé">
          {meLoading ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
              <Text style={{ color: t.muted, fontWeight: '900', marginBottom: 6 }}>Compte</Text>
              <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>{me?.email || me?.username || '—'}</Text>
              <Text style={{ color: t.muted, fontWeight: '800', marginTop: 4 }}>
                Rôle: {String((me as any)?.role || 'user') === 'establishment' ? 'Owner' : 'User'}
              </Text>
            </View>
          )}
        </SettingsSection>

        <SettingsSection title="Menu">
          {filtered.length === 0 ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Aucun résultat</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>Essayez un autre mot-clé.</Text>
            </View>
          ) : (
            filtered.map((it, idx) => (
              <React.Fragment key={it.key}>
                <SettingsRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.route as any)} />
                {idx !== filtered.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


