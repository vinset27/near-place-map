import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, SettingsRow, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function SettingsAbout() {
  const t = useAppTheme();
  const router = useRouter();
  const appName = (Constants.expoConfig as any)?.name || "O'Show";
  const version = (Constants.expoConfig as any)?.version || '—';
  const env = (Constants.expoConfig as any)?.extra?.env || (process.env.EXPO_PUBLIC_ENV as any) || 'prod';

  return (
    <SettingsScreenShell title="About">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Application">
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '900', marginBottom: 6 }}>Nom</Text>
            <Text style={{ color: t.text, fontWeight: '900', fontSize: 18 }}>{appName}</Text>
            <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }}>Version: {version}</Text>
            <Text style={{ color: t.muted, fontWeight: '800', marginTop: 2 }}>Environnement: {String(env)}</Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Légal">
          <SettingsRow icon="📄" title="Conditions d’utilisation" subtitle="Lecture" onPress={() => router.push('/settings/terms')} />
          <Divider />
          <SettingsRow icon="🔐" title="Politique de confidentialité" subtitle="Lecture" onPress={() => router.push('/settings/privacy-policy')} />
        </SettingsSection>

        <SettingsSection title="Infos">
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              © {new Date().getFullYear()} BinarySecurity. Tous droits réservés.
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


