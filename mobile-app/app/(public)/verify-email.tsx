import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authMe, resendEmailVerification, verifyEmailCode } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';
import { InlineToast } from '../../components/Settings/SettingsPrimitives';

const HERO_IMAGE = require('../../assets/119589243_10178365.jpg');

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = String(params.next || '').trim();
  const qc = useQueryClient();
  const t = useAppTheme();
  const tint = usePrimaryTints();

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['auth-me'], queryFn: () => authMe(), staleTime: 1000 * 20, retry: false });
  const isAuthed = !!me;
  const isEmailVerified = !!me && (me as any)?.emailVerified !== false;

  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const digits = useMemo(() => {
    const c = String(code || '').replace(/\D/g, '').slice(0, 6);
    return Array.from({ length: 6 }).map((_, i) => c[i] || '');
  }, [code]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (meLoading) return;
    // If not authed, allow verifying with (email + code) on this same screen.
    if (!isAuthed) return;
    setEmail(String((me as any)?.email || (me as any)?.username || ''));
  }, [isAuthed, meLoading, router]);

  useEffect(() => {
    if (!isEmailVerified) return;
    // Already verified -> continue.
    if (next) router.replace(next as any);
    else router.replace('/post-register');
  }, [isEmailVerified, next, router]);

  const resend = async () => {
    setLoading(true);
    try {
      await resendEmailVerification();
      setToast('Code envoyé par email.');
    } catch (e: any) {
      setToast(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const c = String(code).trim();
    if (!/^\d{6}$/.test(c)) return setToast('Code invalide (6 chiffres).');
    setLoading(true);
    try {
      const mail = isAuthed ? String((me as any)?.email || (me as any)?.username || '') : String(email || '');
      await verifyEmailCode(c, mail);
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      setToast('Email confirmé ✅');
      setCode('');
      // Redirect happens via effect once auth-me shows emailVerified true.
    } catch (e: any) {
      setToast(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <PublicScaffold
            heroImage={HERO_IMAGE}
            cardTitle="Confirmer l’email"
            cardSubtitle="Saisis le code reçu par email"
            onBack={() => {
              // Avoid GO_BACK warning when this screen is the first route in stack.
              if ((router as any)?.canGoBack?.()) router.back();
              else router.replace('/login');
            }}
          >
            {!!toast && <InlineToast text={toast} tone={toast.toLowerCase().includes('erreur') ? 'danger' : 'ok'} />}

            <View style={{ gap: 12, marginTop: 6 }}>
              {!isAuthed && (
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Votre email"
                    placeholderTextColor="rgba(11,18,32,0.45)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ color: '#0b1220', fontWeight: '400' }}
                  />
                </LinearGradient>
              )}

              {/* OTP boxes (6 digits) to avoid input misinterpretation */}
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => inputRef.current?.focus()}
                style={{
                  borderRadius: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  backgroundColor: 'rgba(11,18,32,0.04)',
                  borderWidth: 1,
                  borderColor: 'rgba(11,18,32,0.08)',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  {digits.map((d, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 54,
                        borderRadius: 14,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: d ? 'rgba(37,99,235,0.35)' : 'rgba(11,18,32,0.10)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#0b1220', fontWeight: '800', fontSize: 18 }}>{d || ' '}</Text>
                    </View>
                  ))}
                </View>

                {/* Hidden input that actually captures digits (supports paste / one-time-code) */}
                <TextInput
                  ref={(r) => (inputRef.current = r)}
                  value={String(code || '')}
                  onChangeText={(v) => setCode(String(v || '').replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading || !/^\d{6}$/.test(String(code).trim())}
                onPress={submit}
                style={{ opacity: loading ? 0.75 : 1, borderRadius: 999, overflow: 'hidden' }}
                activeOpacity={0.9}
              >
                <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: 'center' }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Valider</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading || !isAuthed}
                onPress={resend}
                style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 10, opacity: loading || !isAuthed ? 0.55 : 1 }}
              >
                <Text style={{ color: 'rgba(11,18,32,0.55)', fontSize: 12, fontWeight: '400', textDecorationLine: 'underline' }}>
                  Renvoyer le code
                </Text>
              </TouchableOpacity>

              <Text style={{ textAlign: 'center', color: 'rgba(11,18,32,0.55)', fontSize: 12, fontWeight: '400' }}>
                Email: {isAuthed ? String((me as any)?.email || (me as any)?.username || '—') : String(email || '—')}
              </Text>
            </View>
          </PublicScaffold>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


