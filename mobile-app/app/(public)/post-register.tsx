import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';
import { upsertProProfile } from '../../services/pro';
import { DEFAULT_LOCATION } from '../../services/location';

const HERO_IMAGE = require('../../assets/119589243_10178365.jpg');

const KEY_REFERRAL = 'nearplace:onboarding:referral:v1';
const KEY_TERMS = 'nearplace:onboarding:termsAccepted:v1';

type Step = 1 | 2 | 3 | 4;
type AccountType = 'user' | 'establishment';

export default function PostRegisterFlow() {
  const router = useRouter();
  const qc = useQueryClient();
  const tint = usePrimaryTints();

  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // establishment fields
  const [bizName, setBizName] = useState('');
  const [bizCat, setBizCat] = useState('restaurant');
  const [bizPhone, setBizPhone] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizCommune, setBizCommune] = useState('');

  // user referral
  const [referral, setReferral] = useState<string>('');

  const [termsAccepted, setTermsAccepted] = useState(false);

  const title = useMemo(() => {
    if (step === 1) return 'Votre profil';
    if (step === 2) return type === 'establishment' ? 'Votre établissement' : 'Votre expérience';
    if (step === 3) return 'Conditions';
    return 'Bienvenue';
  }, [step, type]);

  const subtitle = useMemo(() => {
    if (step === 1) return 'Choisissez votre type de compte';
    if (step === 2) return type === 'establishment' ? 'Renseignez les infos principales' : 'Dites-nous comment vous nous avez connu';
    if (step === 3) return 'Dernière étape avant d’entrer';
    return 'Tout est prêt.';
  }, [step, type]);

  const goNext = async () => {
    setErr(null);

    if (step === 1) {
      if (!type) return setErr('Choisis un type de compte.');
      setStep(2);
      return;
    }

    if (step === 2) {
      if (type === 'establishment') {
        const name = bizName.trim();
        if (name.length < 2) return setErr("Nom d'établissement requis.");
        setLoading(true);
        try {
          // Minimal required by backend: name/category/lat/lng
          await upsertProProfile({
            name,
            category: bizCat.trim() || 'restaurant',
            phone: bizPhone.trim() || undefined,
            address: bizAddress.trim() || undefined,
            lat: DEFAULT_LOCATION.lat,
            lng: DEFAULT_LOCATION.lng,
            description: '',
          });
          await qc.invalidateQueries({ queryKey: ['auth-me'] }).catch(() => {});
          await qc.invalidateQueries({ queryKey: ['pro-profile'] }).catch(() => {});
          setStep(3);
        } catch (e: any) {
          setErr(String(e?.response?.data?.message || e?.message || 'Erreur'));
        } finally {
          setLoading(false);
        }
      } else {
        // simple user: store referral locally (no backend field yet)
        const v = String(referral || '').trim();
        if (v.length < 2) return setErr('Choisis une réponse.');
        await AsyncStorage.setItem(KEY_REFERRAL, v).catch(() => {});
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      if (!termsAccepted) return setErr('Tu dois accepter les conditions.');
      await AsyncStorage.setItem(KEY_TERMS, 'true').catch(() => {});
      setStep(4);
      return;
    }

    // step 4
    router.replace(type === 'establishment' ? '/business' : '/map');
  };

  const goBack = () => {
    if (step === 1) return router.back();
    if (step === 2) return setStep(1);
    if (step === 3) return setStep(2);
    if (step === 4) return setStep(3);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <PublicScaffold heroImage={HERO_IMAGE} cardTitle={title} cardSubtitle={subtitle} onBack={goBack}>
            {!!err && (
              <View style={styles.error}>
                <Text style={styles.errorTitle}>Attention</Text>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            )}

            {step === 1 && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setType('user')}
                  style={[styles.choice, type === 'user' && styles.choiceActive]}
                >
                  <Text style={styles.choiceIcon}>👤</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>Utilisateur</Text>
                    <Text style={styles.choiceSub}>Découvrir autour de moi</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setType('establishment')}
                  style={[styles.choice, type === 'establishment' && styles.choiceActive]}
                >
                  <Text style={styles.choiceIcon}>🏪</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>Établissement</Text>
                    <Text style={styles.choiceSub}>Publier et gérer mon lieu</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && type === 'establishment' && (
              <View style={{ gap: 12 }}>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
                  <TextInput value={bizName} onChangeText={setBizName} placeholder="Nom de l’établissement" placeholderTextColor="rgba(11,18,32,0.45)" style={styles.pillInput} />
                </LinearGradient>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
                  <TextInput value={bizCat} onChangeText={setBizCat} placeholder="Catégorie (ex: restaurant)" placeholderTextColor="rgba(11,18,32,0.45)" style={styles.pillInput} />
                </LinearGradient>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
                  <TextInput value={bizPhone} onChangeText={setBizPhone} placeholder="Téléphone (optionnel)" placeholderTextColor="rgba(11,18,32,0.45)" style={styles.pillInput} keyboardType="phone-pad" />
                </LinearGradient>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
                  <TextInput value={bizAddress} onChangeText={setBizAddress} placeholder="Adresse (optionnel)" placeholderTextColor="rgba(11,18,32,0.45)" style={styles.pillInput} />
                </LinearGradient>
                <LinearGradient colors={[tint.fieldA, tint.fieldB]} style={styles.pill}>
                  <TextInput value={bizCommune} onChangeText={setBizCommune} placeholder="Commune/Ville (optionnel)" placeholderTextColor="rgba(11,18,32,0.45)" style={styles.pillInput} />
                </LinearGradient>
                {!!bizCommune && <Text style={styles.helper}>Astuce: tu pourras compléter/ajuster plus tard dans le profil.</Text>}
              </View>
            )}

            {step === 2 && type === 'user' && (
              <View style={{ gap: 12 }}>
                {['Ami / proche', 'Réseaux sociaux', 'Publicité', 'Autre'].map((x) => (
                  <TouchableOpacity key={x} activeOpacity={0.9} onPress={() => setReferral(x)} style={[styles.choice, referral === x && styles.choiceActive]}>
                    <Text style={styles.choiceIcon}>✨</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.choiceTitle}>{x}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step === 3 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.termsText}>
                  En continuant, tu confirmes avoir lu et accepté les conditions d’utilisation et la politique de confidentialité.
                </Text>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setTermsAccepted((v) => !v)} style={[styles.choice, termsAccepted && styles.choiceActive]}>
                  <Text style={styles.choiceIcon}>{termsAccepted ? '✅' : '⬜'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>J’accepte les conditions</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {step === 4 && (
              <View style={{ gap: 12, alignItems: 'center' }}>
                <Text style={styles.welcomeBig}>Bienvenue sur O&apos;Show</Text>
                <Text style={styles.welcomeSub}>Tu peux maintenant explorer l’application.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryWrap, (loading || (step === 2 && type === 'establishment' && !bizName.trim())) && { opacity: 0.65 }]}
              disabled={loading}
              onPress={() => void goNext()}
              activeOpacity={0.9}
            >
              <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{step === 4 ? 'Entrer' : 'Continuer'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </PublicScaffold>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  error: { marginTop: 4, marginBottom: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 18, padding: 12 },
  errorTitle: { color: '#0b1220', fontWeight: '600', marginBottom: 2, fontSize: 13 },
  errorText: { color: 'rgba(11,18,32,0.72)', fontWeight: '400', fontSize: 12, lineHeight: 16 },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(11,18,32,0.04)',
  },
  choiceActive: { backgroundColor: 'rgba(37,99,235,0.10)' },
  choiceIcon: { fontSize: 18 },
  choiceTitle: { color: '#0b1220', fontWeight: '500', fontSize: 14 },
  choiceSub: { marginTop: 2, color: 'rgba(11,18,32,0.55)', fontWeight: '400', fontSize: 12 },

  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 },
  pillInput: { color: '#0b1220', fontSize: 14, fontWeight: '400' },
  helper: { color: 'rgba(11,18,32,0.55)', fontWeight: '400', fontSize: 12 },

  termsText: { color: 'rgba(11,18,32,0.70)', fontWeight: '400', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  welcomeBig: { color: '#0b1220', fontWeight: '600', fontSize: 20, textAlign: 'center' },
  welcomeSub: { color: 'rgba(11,18,32,0.60)', fontWeight: '400', fontSize: 13, textAlign: 'center' },

  primaryWrap: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  primary: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});


