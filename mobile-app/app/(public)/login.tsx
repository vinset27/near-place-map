import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { authLogin } from '../../services/auth';

export default function LoginScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await authLogin({ username: username.trim(), password });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      router.replace('/business');
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
              <Text style={styles.kicker}>O'Show • Accès</Text>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.sub}>Accède à ton espace Pro (profil, établissement, évènements).</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="contact@domaine.com"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Mot de passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.input}
              />

              <TouchableOpacity style={styles.forgot} onPress={() => router.push('/settings/change-password')}>
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {!!error && (
                <View style={styles.error}>
                  <Text style={styles.errorTitle}>Connexion impossible</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.primary, (loading || !username.trim() || !password) && { opacity: 0.7 }]} disabled={loading} onPress={submit}>
                {loading ? <ActivityIndicator color="#0b1220" /> : <Text style={styles.primaryText}>Se connecter</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondary} onPress={() => router.push('/register')}>
                <Text style={styles.secondaryText}>Créer un compte</Text>
              </TouchableOpacity>

              <Text style={styles.foot}>
                Si tu viens de t’inscrire, confirme ton email avant d’activer l’espace Pro.
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
  label: { color: 'rgba(255,255,255,0.86)', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { marginTop: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: '800' },
  primary: { marginTop: 16, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#0b1220', fontWeight: '950' },
  secondary: { marginTop: 10, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)' },
  secondaryText: { color: '#fff', fontWeight: '900' },
  error: { marginTop: 12, backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1, borderRadius: 16, padding: 12 },
  errorTitle: { color: '#fff', fontWeight: '950', marginBottom: 4 },
  errorText: { color: 'rgba(255,255,255,0.86)', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  foot: { marginTop: 12, color: 'rgba(255,255,255,0.62)', fontWeight: '700', fontSize: 12, lineHeight: 16 },
  forgot: { marginTop: 10, alignSelf: 'flex-start' },
  forgotText: { color: 'rgba(255,255,255,0.92)', fontWeight: '900', textDecorationLine: 'underline' },
});





