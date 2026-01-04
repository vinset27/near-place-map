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
            <Text style={{ color: t.text, fontWeight: '900', marginBottom: 8 }}>1) Données collectées</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Compte: email/identifiant et mot de passe (stocké de façon chiffrée côté serveur).{'\n'}
              - Localisation: utilisée pour afficher les lieux/événements proches et améliorer la pertinence de la carte.{'\n'}
              - Contenus publiés: établissements, événements, photos, descriptions (si vous les soumettez).{'\n'}
              - Données techniques: logs (IP, user-agent), diagnostics et métriques de performance.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>2) Finalités</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              - Fournir le service (connexion, carte, itinéraires, publications).{'\n'}
              - Sécurité (prévention d’abus, vérification email, récupération de mot de passe).{'\n'}
              - Amélioration du produit (statistiques agrégées, qualité de service).
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>3) Partage</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Nous ne vendons pas vos données. Certaines données peuvent être traitées par nos prestataires techniques (hébergement, email, notifications) uniquement pour
              fournir le service.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>4) Conservation</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Les données sont conservées le temps nécessaire à la fourniture du service et au respect des obligations légales. Vous pouvez demander la suppression du compte.
            </Text>

            <Text style={{ marginTop: 12, color: t.text, fontWeight: '900', marginBottom: 8 }}>5) Vos droits</Text>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Accès, rectification, suppression, limitation. Contact: support (voir “Help & Support”).
            </Text>

            <Text style={{ marginTop: 12, color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Dernière mise à jour: 2026-01-04
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}






