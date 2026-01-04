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
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 8 }}>1) Acceptation</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              En utilisant l’application, vous acceptez ces conditions. Si vous n’êtes pas d’accord, n’utilisez pas le service.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>2) Comptes</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Vous êtes responsable de la confidentialité de vos identifiants. Vous devez fournir des informations exactes et maintenir votre compte à jour.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>3) Publications & modération</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Les établissements, événements et annonces soumis peuvent être mis “en attente” et nécessiter une validation avant d’apparaître sur la carte. Nous pouvons refuser,
              retirer ou modifier un contenu pour des raisons de sécurité, conformité, ou qualité.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>4) Interdictions</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Usurpation, fraude, spam, harcèlement{'\n'}
              - Contenu illégal, trompeur, violent, haineux ou non autorisé{'\n'}
              - Tentatives d’attaque, reverse engineering, détournement de service
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>5) Responsabilité</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Le service est fourni “tel quel”. Les informations (horaires, adresse, offres, événements) sont publiées sous la responsabilité de leurs auteurs.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>6) Suspension / suppression</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              En cas d’abus ou de non-respect, nous pouvons suspendre ou supprimer un compte et ses contenus.
            </Text>

            <Text style={{ marginTop: 12, color: t.muted, fontWeight: '800', lineHeight: 18 }}>Dernière mise à jour: 2026-01-04</Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


