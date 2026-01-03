import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { authRegister } from '../../services/auth';
import { useAppTheme } from '../../services/settingsTheme';
import { Ionicons } from '@expo/vector-icons';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';

const HERO_IMAGE = require('../../assets/119589243_10178365.jpg'); // TODO: replace with your custom illustration

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export default function RegisterScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useAppTheme();
  const tint = usePrimaryTints();

  // Extra fields (UI requirement) — backend currently ignores them.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
      // Go through onboarding steps after registration (role, optional establishment info, terms, welcome).
      router.replace('/post-register');
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
          <PublicScaffold heroImage={HERO_IMAGE} cardTitle="Créer un compte" cardSubtitle="Quelques secondes et c’est parti" onBack={() => router.back()}>
            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
              <Ionicons name="person-outline" size={18} color="rgba(11,18,32,0.62)" />
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Prénom"
                placeholderTextColor="rgba(11,18,32,0.45)"
                style={styles.pillInput}
              />
            </LinearGradient>

            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={[styles.pill, { marginTop: 12 }]}>
              <Ionicons name="people-outline" size={18} color="rgba(11,18,32,0.62)" />
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nom"
                placeholderTextColor="rgba(11,18,32,0.45)"
                style={styles.pillInput}
              />
            </LinearGradient>

            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={[styles.pill, { marginTop: 12 }]}>
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

            <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={[styles.pill, { marginTop: 12 }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color="rgba(11,18,32,0.62)" />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder="Confirmation mot de passe"
                placeholderTextColor="rgba(11,18,32,0.45)"
                style={styles.pillInput}
              />
            </LinearGradient>

            {!!password && (
              <Text style={[styles.helper, !passwordOk && { color: 'rgba(239,68,68,0.65)' }]}>{passwordHint}</Text>
            )}

            {!!error && (
              <View style={styles.error}>
                <Text style={styles.errorTitle}>Création impossible</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryWrap, !canSubmit && { opacity: 0.65 }]} disabled={!canSubmit} onPress={submit} activeOpacity={0.9}>
              <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Créer un compte</Text>}
              </LinearGradient>
            </TouchableOpacity>

            {/* Use push (not replace) so Android/iOS back works */}
            <TouchableOpacity style={styles.secondary} onPress={() => router.push('/login')} activeOpacity={0.9}>
              <Text style={styles.secondaryText}>J’ai déjà un compte</Text>
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

  helper: { marginTop: 8, color: 'rgba(11,18,32,0.55)', fontWeight: '400', fontSize: 12 },

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





