/**
 * Ready (Public)
 * Écran de transition avant entrée dans l'app.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../stores/useLocationStore';
import { hasLocationPermission } from '../../services/location';

export default function PublicReady() {
  const router = useRouter();
  const { hasPermission, setHasPermission } = useLocationStore();

  useEffect(() => {
    // Ensure store is in sync (in case user allowed via system prompt)
    hasLocationPermission().then((g) => setHasPermission(g));
  }, [setHasPermission]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0b1220', '#0b2a6b', '#2563eb']} style={styles.bg}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.kicker}>Prêt</Text>
            <Text style={styles.title}>{hasPermission ? 'Tout est prêt.' : 'Prêt à explorer.'}</Text>
            <Text style={styles.subtitle}>
              {hasPermission
                ? 'Ta position est activée. Les lieux proches vont s’afficher automatiquement.'
                : 'Tu peux explorer dès maintenant. La position par défaut sera utilisée.'}
            </Text>

            <View style={styles.badges}>
              <Badge label={hasPermission ? 'GPS: activé' : 'GPS: désactivé'} />
              <Badge label="Carte + Liste" />
              <Badge label="Détails + Itinéraire" />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/map')}>
              <Text style={styles.primaryBtnText}>Entrer dans l’app</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
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
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 16 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0b2a6b', fontSize: 15, fontWeight: '900' },
});


