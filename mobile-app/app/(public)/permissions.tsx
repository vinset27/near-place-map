/**
 * Permissions (Public)
 * Demandé après l'onboarding immersif (sans "étapes" numérotées).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { requestLocationPermission } from '../../services/location';
import { useLocationStore } from '../../stores/useLocationStore';

export default function PublicPermissions() {
  const router = useRouter();
  const { setHasPermission } = useLocationStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setError(null);
    setLoading(true);
    const res = await requestLocationPermission();
    setLoading(false);
    setHasPermission(res.granted);
    if (!res.granted) setError(res.error || 'Permission refusée');
    router.replace('/ready');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0b1220', '#0b2a6b', '#2563eb']} style={styles.bg}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.kicker}>Localisation</Text>
            <Text style={styles.title}>Autoriser la localisation</Text>
            <Text style={styles.subtitle}>
              Pour afficher les lieux près de toi et calculer les itinéraires, O&apos;Show a besoin
              de ta position.
            </Text>

            <View style={styles.bullets}>
              <Bullet text="Affiche ta position sur la carte" />
              <Bullet text="Trie la liste par distance" />
              <Bullet text="Calcule l’itinéraire vers un établissement" />
            </View>

            {!!error && (
              <View style={styles.warn}>
                <Text style={styles.warnTitle}>GPS non activé</Text>
                <Text style={styles.warnText}>
                  Aucun souci: l’app fonctionnera avec une position par défaut. Tu pourras activer
                  le GPS plus tard.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={ask}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0b2a6b" />
                ) : (
                  <Text style={styles.primaryBtnText}>Autoriser</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/ready')}>
                <Text style={styles.secondaryBtnText}>Plus tard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.dot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  bg: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  kicker: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20 },
  bullets: { marginTop: 14, gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  bulletText: { color: 'rgba(255,255,255,0.88)', fontSize: 13, flex: 1 },
  warn: {
    marginTop: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  warnTitle: { color: '#fff', fontWeight: '900', marginBottom: 4 },
  warnText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 16 },
  actions: { marginTop: 16, gap: 10 },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#0b2a6b', fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});


