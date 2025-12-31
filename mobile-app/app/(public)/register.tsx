import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { authRegister } from '../../services/auth';

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export default function RegisterScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [asPro, setAsPro] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = username.trim().toLowerCase();
  const passwordOk = password.length >= 6;
  const emailOk = looksLikeEmail(email);
  const confirmOk = confirm.length > 0 && confirm === password;
  const canSubmit = emailOk && passwordOk && confirmOk && !loading;

  const passwordHint = useMemo(() => {
    if (!password) return 'Au moins 6 caractères.';
    if (password.length < 6) return 'Trop court (min 6).';
    return 'OK.';
  }, [password]);

  const submit = async () => {
    setError(null);
    if (!emailOk) {
      setError('Email invalide.');
      return;
    }
    if (!passwordOk) {
      setError('Mot de passe trop court (min 6).');
      return;
    }
    if (!confirmOk) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await authRegister({ username: email, password });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      router.replace(asPro ? '/business' : '/map');
    } catch (e: any) {
      setError(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#070b13', '#0b2a6b', '#2563eb']} style={styles.bg}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.container}>
            <View style={styles.hero}>
              <Text style={styles.kicker}>O'Show • Compte</Text>
              <Text style={styles.title}>Créer un compte</Text>
              <Text style={styles.sub}>Email de confirmation requis pour activer l’espace Pro.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.segment}>
                <TouchableOpacity onPress={() => setAsPro(true)} style={[styles.segBtn, asPro && styles.segBtnActive]}>
                  <Text style={[styles.segText, asPro && styles.segTextActive]}>Établissement</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAsPro(false)} style={[styles.segBtn, !asPro && styles.segBtnActive]}>
                  <Text style={[styles.segText, !asPro && styles.segTextActive]}>Utilisateur</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.segHint}>
                {asPro ? "Publier établissement + évènements." : "Découvrir autour de moi."}
              </Text>

              <Text style={[styles.label, { marginTop: 14 }]}>Email</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="contact@domaine.com"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={[styles.input, username.length > 0 && !emailOk && styles.inputWarn]}
              />
              {!!username && (
                <Text style={[styles.helper, !emailOk && { color: 'rgba(251,191,36,0.95)' }]}>
                  {emailOk ? 'OK.' : 'Email invalide.'}
                </Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Mot de passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={[styles.input, !!password && !passwordOk && styles.inputWarn]}
              />
              {!!password && (
                <Text style={[styles.helper, !passwordOk && { color: 'rgba(251,191,36,0.95)' }]}>{passwordHint}</Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Confirmer</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={[styles.input, !!confirm && !confirmOk && styles.inputWarn]}
              />
              {!!confirm && (
                <Text style={[styles.helper, !confirmOk && { color: 'rgba(251,191,36,0.95)' }]}>
                  {confirmOk ? 'OK.' : 'Ne correspond pas.'}
                </Text>
              )}

              {!!error && (
                <View style={styles.error}>
                  <Text style={styles.errorTitle}>Création impossible</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.primary, !canSubmit && { opacity: 0.6 }]} disabled={!canSubmit} onPress={submit}>
                {loading ? <ActivityIndicator color="#0b1220" /> : <Text style={styles.primaryText}>Créer mon compte</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondary} onPress={() => router.replace('/login')}>
                <Text style={styles.secondaryText}>J’ai déjà un compte</Text>
              </TouchableOpacity>

              <Text style={styles.foot}>
                Après création, ouvre ton email et clique sur “Confirmer mon email”.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  bg: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 },
  hero: { paddingTop: 8, paddingBottom: 8 },
  kicker: { color: 'rgba(255,255,255,0.78)', fontWeight: '900', letterSpacing: 0.6, fontSize: 12, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 30, fontWeight: '950', letterSpacing: -0.3, marginTop: 6 },
  sub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, marginTop: 8, maxWidth: 420 },
  card: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 16 },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 999, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { color: 'rgba(255,255,255,0.85)', fontWeight: '900' },
  segTextActive: { color: '#0b1220' },
  segHint: { marginTop: 8, color: 'rgba(255,255,255,0.70)', fontWeight: '700', fontSize: 12 },
  label: { color: 'rgba(255,255,255,0.86)', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { marginTop: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: '800' },
  inputWarn: { borderColor: 'rgba(251,191,36,0.7)' },
  helper: { marginTop: 6, color: 'rgba(255,255,255,0.66)', fontWeight: '700', fontSize: 12 },
  primary: { marginTop: 16, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#0b1220', fontWeight: '950' },
  secondary: { marginTop: 10, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)' },
  secondaryText: { color: '#fff', fontWeight: '900' },
  error: { marginTop: 12, backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1, borderRadius: 16, padding: 12 },
  errorTitle: { color: '#fff', fontWeight: '950', marginBottom: 4 },
  errorText: { color: 'rgba(255,255,255,0.86)', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  foot: { marginTop: 12, color: 'rgba(255,255,255,0.62)', fontWeight: '700', fontSize: 12, lineHeight: 16 },
});





