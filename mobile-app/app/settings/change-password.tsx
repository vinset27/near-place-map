import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authMe, changePassword, requestPasswordReset, resetPassword } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { InlineToast, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';

export default function ChangePasswordScreen() {
  const t = useAppTheme();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const isAuthed = !!me;

  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Logged-in change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');

  // Reset password (not logged-in)
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetPass, setResetPass] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!me) return;
    setEmail(String(me.email || me.username || '').trim());
  }, [me]);

  const submitChange = async () => {
    if (newPassword.trim().length < 6) return setToast('Mot de passe trop court (6 caractères minimum).');
    if (newPassword !== confirmNew) return setToast('Les mots de passe ne correspondent pas.');
    if (currentPassword.trim().length < 6) return setToast('Mot de passe actuel requis.');
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setToast('Mot de passe modifié.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNew('');
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
    } catch (e: any) {
      setToast(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setToast('Email invalide.');
    setLoading(true);
    try {
      await requestPasswordReset(e);
      setCodeRequested(true);
      setToast('Code envoyé par email.');
    } catch (err: any) {
      setToast(String(err?.response?.data?.message || err?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setToast('Email invalide.');
    if (String(code).trim().length < 4) return setToast('Code requis.');
    if (resetPass.trim().length < 6) return setToast('Mot de passe trop court (6 caractères minimum).');
    if (resetPass !== resetConfirm) return setToast('Les mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await resetPassword({ email: e, code: String(code).trim(), newPassword: resetPass });
      setToast('Mot de passe réinitialisé. Vous pouvez vous connecter.');
      setCode('');
      setResetPass('');
      setResetConfirm('');
    } catch (err: any) {
      setToast(String(err?.response?.data?.message || err?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsScreenShell title="Mot de passe">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} tone={toast.toLowerCase().includes('erreur') ? 'danger' : 'ok'} />}

        {isAuthed ? (
          <SettingsSection title="Changer mot de passe (connecté)">
            <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}>
              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Mot de passe actuel</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="••••••••"
                  placeholderTextColor={t.muted}
                  secureTextEntry
                  style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                />
              </View>
              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Nouveau mot de passe</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="6 caractères minimum"
                  placeholderTextColor={t.muted}
                  secureTextEntry
                  style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                />
              </View>
              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Confirmer</Text>
                <TextInput
                  value={confirmNew}
                  onChangeText={setConfirmNew}
                  placeholder="Répéter"
                  placeholderTextColor={t.muted}
                  secureTextEntry
                  style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                />
              </View>
              <TouchableOpacity
                disabled={loading}
                onPress={submitChange}
                style={{ opacity: loading ? 0.75 : 1, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : null}
                <Text style={{ color: '#fff', fontWeight: '900' }}>{loading ? '…' : 'Mettre à jour'}</Text>
              </TouchableOpacity>
            </View>
          </SettingsSection>
        ) : (
          <SettingsSection title="Réinitialisation (code email)">
            <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}>
              <View>
                <Text style={{ color: t.muted, fontWeight: '900' }}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@email.com"
                  placeholderTextColor={t.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                />
              </View>

              <TouchableOpacity
                disabled={loading}
                onPress={requestCode}
                style={{ opacity: loading ? 0.75 : 1, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : null}
                <Text style={{ color: '#fff', fontWeight: '900' }}>{loading ? '…' : 'Envoyer le code'}</Text>
              </TouchableOpacity>

              {codeRequested && (
                <>
                  <View>
                    <Text style={{ color: t.muted, fontWeight: '900' }}>Code reçu</Text>
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      placeholder="123456"
                      placeholderTextColor={t.muted}
                      keyboardType="number-pad"
                      style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                    />
                  </View>
                  <View>
                    <Text style={{ color: t.muted, fontWeight: '900' }}>Nouveau mot de passe</Text>
                    <TextInput
                      value={resetPass}
                      onChangeText={setResetPass}
                      placeholder="6 caractères minimum"
                      placeholderTextColor={t.muted}
                      secureTextEntry
                      style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                    />
                  </View>
                  <View>
                    <Text style={{ color: t.muted, fontWeight: '900' }}>Confirmer</Text>
                    <TextInput
                      value={resetConfirm}
                      onChangeText={setResetConfirm}
                      placeholder="Répéter"
                      placeholderTextColor={t.muted}
                      secureTextEntry
                      style={{ marginTop: 8, backgroundColor: t.input, borderColor: t.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, color: t.text, fontWeight: '800' }}
                    />
                  </View>
                  <TouchableOpacity
                    disabled={loading}
                    onPress={submitReset}
                    style={{ opacity: loading ? 0.75 : 1, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{loading ? '…' : 'Valider'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </SettingsSection>
        )}
      </ScrollView>
    </SettingsScreenShell>
  );
}


