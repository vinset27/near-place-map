import React from 'react';
import { ScrollView, View, Text, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, SettingsRow, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function SettingsHelp() {
  const t = useAppTheme();
  const router = useRouter();
  const appName = (Constants.expoConfig as any)?.name || "O'Show";

  const mail = async (subject: string, body: string) => {
    await Linking.openURL(
      `mailto:mapper-oshow@binarysecurity.com?subject=${encodeURIComponent(`${appName} — ${subject}`)}&body=${encodeURIComponent(body)}`
    );
  };

  const openWhatsApp = async () => {
    const text = encodeURIComponent(`${appName} — Support\n\nBonjour, j’ai besoin d’aide.`);
    await Linking.openURL(`whatsapp://send?text=${text}`);
  };

  return (
    <SettingsScreenShell title="Help and Support">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Aide">
          <SettingsRow icon="📚" title="Centre d’aide (FAQ)" subtitle="Réponses rapides (dans l’app)" onPress={() => router.push('/settings/faq')} />
          <Divider />
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>FAQ</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Je ne vois pas mon établissement: vérifiez la localisation et le statut Pro.{'\n'}
              - L’API est lente: attendez 20–30s (cold start) puis réessayez.{'\n'}
              - Email non confirmé: renvoyez l’email depuis /pro.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsRow icon="✉️" title="Contacter le support (email)" subtitle="Réponse rapide, sécurisé" onPress={() => mail('Support', 'Bonjour,\n\nJe rencontre un problème :\n\nDétails :\n')} />
          <Divider />
          <SettingsRow icon="💬" title="Contacter le support (WhatsApp)" subtitle="Chat" onPress={openWhatsApp} />
          <Divider />
          <SettingsRow
            icon="🐞"
            title="Signaler un problème"
            subtitle="Envoyer un diagnostic"
            onPress={() =>
              mail(
                'Bug report',
                `Bonjour,\n\nProblème rencontré :\n\nÉtapes pour reproduire :\n1)\n2)\n\nApp: ${appName}\nVersion: ${(Constants.expoConfig as any)?.version || '—'}\n`
              )
            }
          />
          <Divider />
          <SettingsRow icon="📝" title="Donner un feedback" subtitle="Suggérer une amélioration" onPress={() => mail('Feedback', 'Bonjour,\n\nVoici ma suggestion :\n')} />
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


