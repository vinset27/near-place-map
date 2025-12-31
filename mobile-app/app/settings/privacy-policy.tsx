import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useAppTheme } from '../../services/settingsTheme';
import { SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function PrivacyPolicyScreen() {
  const t = useAppTheme();
  return (
    <SettingsScreenShell title="Confidentialité">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Politique de confidentialité">
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 8 }}>Données utilisées</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Localisation: pour afficher les établissements proches.{'\n'}
              - Compte: email (connexion et sécurité).{'\n'}
              - Usage: statistiques anonymisées (vues) pour améliorer l’expérience.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>Contrôle</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Vous pouvez gérer les permissions dans “Privacy & Security”. Pour suppression de compte, utilisez l’option dédiée (demande via support).
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}



