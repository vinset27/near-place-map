import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Switch, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, InlineToast, SettingsRow, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useLocationStore } from '../../stores/useLocationStore';
import { authMe, deleteAccount } from '../../services/auth';

export default function SettingsPrivacy() {
  const t = useAppTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const hide = useSettingsStore((s) => s.hideMyEstablishmentsOnThisDevice);
  const setHide = useSettingsStore((s) => s.setHideMyEstablishmentsOnThisDevice);
  const hasLoc = useLocationStore((s) => s.hasPermission);
  const resetLocation = useLocationStore((s) => s.reset);
  const resetSettings = useSettingsStore((s) => s.reset);
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const isAuthed = !!me;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(id);
  }, [toast]);

  const openOsSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setToast("Impossible d’ouvrir les réglages.");
    }
  };

  const requestAccountDeletion = async () => {
    if (!isAuthed) {
      router.push('/login');
      return;
    }
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert('Suppression du compte', 'Cette action est irréversible. Continuer ?', [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuer', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    const ok2 = await new Promise<boolean>((resolve) => {
      Alert.alert('Confirmer', 'Confirmer la suppression du compte ?', [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok2) return;

    try {
      await deleteAccount();
    } finally {
      // Purge locale quoi qu'il arrive (backend peut être en cold start)
      resetLocation();
      resetSettings();
      qc.clear();
      await AsyncStorage.removeItem('nearplace:rq').catch(() => {});
      router.replace('/map');
    }
  };

  return (
    <SettingsScreenShell title="Privacy & Security">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} tone={toast.includes('Impossible') ? 'warn' : 'ok'} />}

        <SettingsSection title="Visibilité">
          <SettingsRow
            icon="👁️"
            title="Masquer mon établissement (sur ce téléphone)"
            subtitle="N’affiche pas vos établissements dans les listes/cartes sur cet appareil"
            right={
              <Switch
                value={hide}
                onValueChange={(v) => {
                  setHide(v);
                  setToast('Sauvegardé.');
                }}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="Permissions">
          <SettingsRow icon="📍" title="Localisation" subtitle={hasLoc ? 'Autorisé' : 'Non autorisé'} onPress={openOsSettings} />
          <Divider />
          <SettingsRow icon="🔔" title="Notifications" subtitle="Gérer les permissions système" onPress={openOsSettings} />
          <Divider />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Les permissions se gèrent dans les réglages du téléphone.
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <SettingsRow
            icon="🗑️"
            title="Supprimer le compte"
            subtitle={isAuthed ? "Suppression avec confirmation" : 'Connectez-vous pour supprimer le compte'}
            onPress={requestAccountDeletion}
            disabled={!isAuthed}
            right={<Text style={{ color: t.danger, fontWeight: '900' }}>Supprimer</Text>}
          />
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


