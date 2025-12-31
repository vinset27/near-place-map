import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { authMe } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function ChangeEmailScreen() {
  const t = useAppTheme();
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const email = me?.email || me?.username || '';
  const appName = (Constants.expoConfig as any)?.name || "O'Show";

  const open = async () => {
    const subject = encodeURIComponent(`${appName} — Changement d'email`);
    const body = encodeURIComponent(`Bonjour,\n\nJe souhaite changer l'email de mon compte.\n\nEmail actuel: ${email}\nNouvel email: \n\nMerci.`);
    await Linking.openURL(`mailto:mapper-oshow@binarysecurity.com?subject=${subject}&body=${body}`);
  };

  return (
    <SettingsScreenShell title="Modifier email">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Sécurisé">
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Changement via support</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Pour éviter toute fraude, le changement d’email se fait via le support (vérification manuelle).
            </Text>
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.muted, fontWeight: '900' }}>Email actuel</Text>
              <Text style={{ marginTop: 6, color: t.text, fontWeight: '900' }}>{email || '—'}</Text>
            </View>
            <TouchableOpacity
              onPress={open}
              style={{ marginTop: 14, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>Contacter le support</Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


