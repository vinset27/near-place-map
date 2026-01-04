import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authLogout, authMe } from '../../services/auth';
import { fetchProProfile, upsertProProfile } from '../../services/pro';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, InlineToast, SettingsRow, SettingsScreenShell, SettingsSection, SkeletonRow } from '../../components/Settings/SettingsPrimitives';
import { useLocationStore } from '../../stores/useLocationStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

export default function SettingsAccount() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const resetLocation = useLocationStore((s) => s.reset);
  const resetSettings = useSettingsStore((s) => s.reset);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authMe(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const isAuthed = !!me;
  const isEmailVerified = !!me && (me as any)?.emailVerified !== false;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['pro-profile'],
    enabled: isAuthed,
    queryFn: () => fetchProProfile(),
    staleTime: 1000 * 20,
    retry: false,
  });

  const roleLabel = useMemo(() => {
    const r = String((me as any)?.role || 'user');
    return r === 'establishment' ? 'Owner' : r === 'manager' ? 'Manager' : 'User';
  }, [me]);

  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const profLat = Number((profile as any)?.lat);
  const profLng = Number((profile as any)?.lng);
  const hasPrecisePin = Number.isFinite(profLat) && Number.isFinite(profLng);

  // Pre-fill once when profile arrives
  React.useEffect(() => {
    if (!profile) return;
    setOwnerFirstName((v) => (v ? v : String((profile as any).ownerFirstName || '')));
    setOwnerLastName((v) => (v ? v : String((profile as any).ownerLastName || '')));
    setPhone((v) => (v ? v : String((profile as any).phone || '')));
  }, [profile]);

  const canSave =
    isAuthed &&
    !!profile &&
    ownerFirstName.trim().length >= 2 &&
    ownerLastName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    hasPrecisePin &&
    !saving;

  const save = async () => {
    if (!profile) {
      router.push('/profile-establishment');
      return;
    }
    if (!hasPrecisePin) {
      setToast('Veuillez d’abord définir la position sur la carte (profil établissement).');
      setTimeout(() => setToast(null), 2200);
      router.push('/profile-establishment');
      return;
    }
    setToast(null);
    setSaving(true);
    try {
      await upsertProProfile({
        ownerFirstName: ownerFirstName.trim(),
        ownerLastName: ownerLastName.trim(),
        name: profile.name,
        category: profile.category,
        address: profile.address || undefined,
        phone: phone.trim(),
        lat: profLat,
        lng: profLng,
        description: profile.description || undefined,
        avatarUrl: profile.avatarUrl || undefined,
        instagram: profile.instagram || undefined,
        whatsapp: profile.whatsapp || undefined,
        website: profile.website || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['pro-profile'] });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      setToast('Modifications enregistrées.');
      setTimeout(() => setToast(null), 1600);
    } catch (e: any) {
      setToast(String(e?.response?.data?.message || e?.message || 'Erreur'));
      setTimeout(() => setToast(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Déconnexion', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await authLogout().catch(() => {});
    } finally {
      resetLocation();
      resetSettings();
      qc.clear();
      await AsyncStorage.removeItem('nearplace:rq').catch(() => {});
      router.replace('/map');
    }
  };

  return (
    <SettingsScreenShell title="Account">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} tone={toast.includes('Erreur') ? 'danger' : 'ok'} />}

        <SettingsSection title="Informations">
          {meLoading ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : (
            <>
              <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                <Text style={{ color: t.muted, fontWeight: '900', marginBottom: 6 }}>Email</Text>
                <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>{me?.email || me?.username || '—'}</Text>
                <Text style={{ color: t.muted, fontWeight: '800', marginTop: 6 }}>Rôle: {roleLabel}</Text>
                {!isEmailVerified && <Text style={{ color: t.muted, fontWeight: '800', marginTop: 8 }}>Email non vérifié</Text>}
              </View>
              <Divider />
              <SettingsRow icon="✉️" title="Modifier email" subtitle="Changement via support (sécurisé)" onPress={() => router.push('/settings/change-email')} />
              <Divider />
              <SettingsRow icon="🔑" title="Changer mot de passe" subtitle="Réinitialisation via email" onPress={() => router.push('/settings/change-password')} />
            </>
          )}
        </SettingsSection>

        <SettingsSection title="Profil propriétaire">
          {profileLoading ? (
            <>
              <SkeletonRow />
              <Divider />
              <SkeletonRow />
            </>
          ) : !profile ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>Profil établissement requis</Text>
              <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
                Pour modifier nom/téléphone, complétez d’abord votre profil établissement.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 12, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
                onPress={() => router.push('/profile-establishment')}
              >
                <Text style={{ color: '#fff', fontWeight: '900' }}>Ouvrir le profil</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}>
              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Nom (propriétaire)</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TextInput
                    value={ownerLastName}
                    onChangeText={setOwnerLastName}
                    placeholder="Nom"
                    placeholderTextColor={t.muted}
                    style={{
                      flex: 1,
                      backgroundColor: t.input,
                      borderColor: t.border,
                      borderWidth: 1,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: t.text,
                      fontWeight: '800',
                    }}
                  />
                  <TextInput
                    value={ownerFirstName}
                    onChangeText={setOwnerFirstName}
                    placeholder="Prénom"
                    placeholderTextColor={t.muted}
                    style={{
                      flex: 1,
                      backgroundColor: t.input,
                      borderColor: t.border,
                      borderWidth: 1,
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: t.text,
                      fontWeight: '800',
                    }}
                  />
                </View>
              </View>

              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Téléphone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+225 ..."
                  placeholderTextColor={t.muted}
                  style={{
                    marginTop: 8,
                    backgroundColor: t.input,
                    borderColor: t.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    color: t.text,
                    fontWeight: '800',
                  }}
                />
              </View>

              <TouchableOpacity
                disabled={!canSave}
                onPress={save}
                style={{
                  marginTop: 2,
                  opacity: canSave ? 1 : 0.55,
                  backgroundColor: t.primary,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : null}
                <Text style={{ color: '#fff', fontWeight: '900' }}>{saving ? 'Enregistrement…' : 'Sauvegarder'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/profile-establishment')}
                style={{
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: t.input,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Text style={{ color: t.text, fontWeight: '900' }}>Ouvrir le profil complet</Text>
              </TouchableOpacity>
            </View>
          )}
        </SettingsSection>

        {isAuthed && (
          <SettingsSection title="Session">
            <SettingsRow
              icon="🚪"
              title="Déconnexion"
              subtitle="Quitter et sécuriser votre espace"
              onPress={logout}
              right={<Text style={{ color: t.danger, fontWeight: '900' }}>Quitter</Text>}
            />
          </SettingsSection>
        )}
      </ScrollView>
    </SettingsScreenShell>
  );
}


