import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useAppTheme } from '../../services/settingsTheme';
import { SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function TermsScreen() {
  const t = useAppTheme();
  return (
    <SettingsScreenShell title="Conditions">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Conditions d’utilisation">
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 8 }}>Résumé</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              En utilisant l’application, vous acceptez de fournir des informations exactes, de respecter la loi, et de ne pas publier de contenu illégal ou trompeur.
              L’établissement reste responsable des informations affichées (horaires, contact, localisation).
            </Text>
            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>Comportements interdits</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Tentatives de fraude / usurpation{'\n'}
              - Spam et contenus non autorisés{'\n'}
              - Attaques techniques ou détournement de service
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


