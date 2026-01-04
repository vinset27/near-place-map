import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authMe, confirmPasswordChange, requestPasswordChangeCode, requestPasswordReset, resetPassword } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { InlineToast, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';
import { LinearGradient } from 'expo-linear-gradient';

export default function ChangePasswordScreen() {
  const t = useAppTheme();
  const tint = usePrimaryTints();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const isAuthed = !!me;

  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Logged-in change password (code flow)
  const [changeStep, setChangeStep] = useState<'request' | 'confirm'>('request');
  const [changeCode, setChangeCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');

  // Reset password (not logged-in)
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetPass, setResetPass] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!me) return;
    setEmail(String(me.email || me.username || '').trim());
  }, [me]);

  const requestChangeCode = async () => {
    setLoading(true);
    try {
      await requestPasswordChangeCode();
      setToast('Code envoyé par email.');
      setChangeStep('confirm');
    } catch (e: any) {
      setToast(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  const submitChange = async () => {
    const c = String(changeCode).trim();
    if (!/^\d{6}$/.test(c)) return setToast('Code invalide (6 chiffres).');
    if (newPassword.trim().length < 6) return setToast('Mot de passe trop court (6 caractères minimum).');
    if (newPassword !== confirmNew) return setToast('Les mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await confirmPasswordChange({ code: c, newPassword });
      setToast('Mot de passe modifié.');
      setChangeCode('');
      setNewPassword('');
      setConfirmNew('');
      setChangeStep('request');
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
      setResetStep('confirm');
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

  if (!isAuthed) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <PublicScaffold
            heroImage={require('../../assets/119589227_10198948.jpg')}
            cardTitle={resetStep === 'request' ? 'Réinitialiser' : 'Saisir le code'}
            cardSubtitle={resetStep === 'request' ? 'Recevez un code par email' : 'Définissez un nouveau mot de passe'}
          >
            {!!toast && <InlineToast text={toast} tone={toast.toLowerCase().includes('erreur') ? 'danger' : 'ok'} />}

            {resetStep === 'request' && (
              <>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4 }}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="rgba(11,18,32,0.45)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{ color: '#0b1220', fontWeight: '400' }}
                  />
                </LinearGradient>

                <TouchableOpacity
                  disabled={loading}
                  onPress={requestCode}
                  style={{ marginTop: 14, opacity: loading ? 0.75 : 1, borderRadius: 999, overflow: 'hidden' }}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Envoyer le code</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'confirm' && (
              <View style={{ marginTop: 6, gap: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    setResetStep('request');
                    setCodeRequested(false);
                    setCode('');
                    setResetPass('');
                    setResetConfirm('');
                  }}
                  style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10 }}
                >
                  <Text style={{ color: 'rgba(11,18,32,0.55)', fontWeight: '400', fontSize: 12 }}>← Changer d’email / renvoyer</Text>
                </TouchableOpacity>

                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="Code reçu"
                    placeholderTextColor="rgba(11,18,32,0.45)"
                    keyboardType="number-pad"
                    style={{ color: '#0b1220', fontWeight: '400' }}
                  />
                </LinearGradient>

                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <TextInput
                    value={resetPass}
                    onChangeText={setResetPass}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="rgba(11,18,32,0.45)"
                    secureTextEntry
                    style={{ color: '#0b1220', fontWeight: '400' }}
                  />
                </LinearGradient>

                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <TextInput
                    value={resetConfirm}
                    onChangeText={setResetConfirm}
                    placeholder="Confirmer"
                    placeholderTextColor="rgba(11,18,32,0.45)"
                    secureTextEntry
                    style={{ color: '#0b1220', fontWeight: '400' }}
                  />
                </LinearGradient>

                <TouchableOpacity
                  disabled={loading || !codeRequested}
                  onPress={submitReset}
                  style={{ marginTop: 4, opacity: loading ? 0.75 : 1, borderRadius: 999, overflow: 'hidden' }}
                  activeOpacity={0.9}
                >
                  <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Valider</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </PublicScaffold>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SettingsScreenShell title="Mot de passe">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} tone={toast.toLowerCase().includes('erreur') ? 'danger' : 'ok'} />}

        {isAuthed ? (
          <SettingsSection title="Changer mot de passe (connecté)">
            <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 12 }}>
              {changeStep === 'request' && (
                <>
                  <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
                    Un code va être envoyé à votre email ({String((me as any)?.email || (me as any)?.username || '—')}).
                  </Text>

                  <TouchableOpacity
                    disabled={loading}
                    onPress={requestChangeCode}
                    style={{ opacity: loading ? 0.75 : 1, backgroundColor: t.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{loading ? '…' : 'Envoyer le code'}</Text>
                  </TouchableOpacity>
                </>
              )}

              {changeStep === 'confirm' && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setChangeStep('request');
                      setChangeCode('');
                      setNewPassword('');
                      setConfirmNew('');
                    }}
                    style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10 }}
                  >
                    <Text style={{ color: t.muted, fontWeight: '800' }}>← Changer d’email / renvoyer</Text>
                  </TouchableOpacity>

                  <View>
                    <Text style={{ color: t.muted, fontWeight: '900' }}>Code (6 chiffres)</Text>
                    <TextInput
                      value={changeCode}
                      onChangeText={(v) => setChangeCode(String(v || '').replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      placeholderTextColor={t.muted}
                      keyboardType="number-pad"
                      maxLength={6}
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
                </>
              )}
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


