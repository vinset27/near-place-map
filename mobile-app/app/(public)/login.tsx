import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { authLogin } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { Ionicons } from '@expo/vector-icons';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';

const HERO_IMAGE = require('../../assets/119589227_10198948.jpg'); // TODO: replace with your custom illustration

export default function LoginScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const tint = usePrimaryTints();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await authLogin({ username: username.trim(), password });
      await qc.invalidateQueries({ queryKey: ['auth-me'] });
      if ((user as any)?.emailVerified === false) {
        router.replace('/verify-email');
        return;
      }
      // Route depending on role (avoid confusing users that are not "establishment").
      const role = String((user as any)?.role || 'user');
      if (role === 'admin') {
        router.replace('/admin');
        return;
      }
      if (role === 'establishment') router.replace('/business');
      else router.replace('/map');
    } catch (e: any) {
      setError(String(e?.response?.data?.message || e?.message || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <PublicScaffold heroImage={HERO_IMAGE} cardTitle="Connexion" cardSubtitle="Accède à ton compte" onBack={() => router.back()}>
            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
              <Ionicons name="mail-outline" size={18} color="rgba(11,18,32,0.62)" />
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="rgba(11,18,32,0.45)"
                style={styles.pillInput}
              />
            </LinearGradient>

            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={[styles.pill, { marginTop: 12 }]}>
              <Ionicons name="lock-closed-outline" size={18} color="rgba(11,18,32,0.62)" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mot de passe"
                placeholderTextColor="rgba(11,18,32,0.45)"
                style={styles.pillInput}
              />
            </LinearGradient>

            <TouchableOpacity style={styles.forgot} onPress={() => router.push('/settings/change-password')}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {!!error && (
              <View style={styles.error}>
                <Text style={styles.errorTitle}>Connexion impossible</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryWrap, (loading || !username.trim() || !password) && { opacity: 0.65 }]}
              disabled={loading || !username.trim() || !password}
              onPress={submit}
              activeOpacity={0.9}
            >
              <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Se connecter</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondary} onPress={() => router.push('/register')} activeOpacity={0.9}>
              <Text style={styles.secondaryText}>Créer un compte</Text>
            </TouchableOpacity>
          </PublicScaffold>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  pillInput: { flex: 1, color: '#0b1220', fontSize: 14, fontWeight: '400' },

  forgot: { marginTop: 10, alignSelf: 'flex-end' },
  forgotText: { color: 'rgba(11,18,32,0.55)', fontSize: 12, fontWeight: '400', textDecorationLine: 'underline' },

  error: { marginTop: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 18, padding: 12 },
  errorTitle: { color: '#0b1220', fontWeight: '500', marginBottom: 4, fontSize: 13 },
  errorText: { color: 'rgba(11,18,32,0.70)', fontWeight: '400', fontSize: 12, lineHeight: 16 },

  primaryWrap: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  primary: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryText: { color: '#fff', fontWeight: '500', fontSize: 15 },

  secondary: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: 'rgba(11,18,32,0.60)', fontWeight: '400', textDecorationLine: 'underline' },
});





