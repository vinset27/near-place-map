import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useAppTheme } from '../../services/settingsTheme';
import { SearchBar, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

type FaqItem = { q: string; a: string };

export default function SettingsFaq() {
  const t = useAppTheme();
  const [q, setQ] = useState('');

  const items: FaqItem[] = useMemo(
    () => [
      {
        q: 'Je ne vois pas mon établissement sur la carte',
        a: 'Vérifiez que la localisation est autorisée. Dans Pro, assurez-vous d’avoir un établissement validé. Si vous avez activé “Masquer sur ce téléphone”, désactivez-le.',
      },
      {
        q: 'La carte ne se centre pas sur ma position',
        a: 'Autorisez la localisation, puis utilisez “Ma position”. Si le GPS met du temps, attendez quelques secondes en extérieur.',
      },
      {
        q: "Je n'arrive pas à accéder au dashboard Pro",
        a: 'Confirmez votre email depuis la page de vérification (code à 6 chiffres).',
      },
      {
        q: 'Le backend est lent (cold start)',
        a: 'Sur Render, le premier appel peut prendre 20–30 secondes. Réessayez ensuite.',
      },
      {
        q: 'Comment choisir le mode de déplacement',
        a: "Dans Profil établissement, choisissez le mode par défaut (voiture / à pied / vélo). Vous pourrez toujours le changer sur la fiche d’un établissement.",
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => `${it.q} ${it.a}`.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <SettingsScreenShell title="FAQ">
      <SearchBar value={q} onChangeText={setQ} placeholder="Search for a setting…" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SettingsSection title="Questions fréquentes">
          {filtered.length === 0 ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Aucun résultat</Text>
              <Text style={{ color: t.muted, fontWeight: '800' }}>Essayez un autre mot.</Text>
            </View>
          ) : (
            filtered.map((it) => (
              <View key={it.q} style={{ paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: t.border }}>
                <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>{it.q}</Text>
                <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>{it.a}</Text>
              </View>
            ))
          )}
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


