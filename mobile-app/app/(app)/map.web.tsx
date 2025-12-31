/**
 * Web fallback for the Map screen.
 * We target iOS/Android; keep web build from crashing on react-native-maps.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapScreenWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>O&apos;Show</Text>
      <Text style={styles.subtitle}>La carte est disponible sur mobile (iOS / Android).</Text>
      <Text style={styles.hint}>Lance Expo en mode LAN puis scanne le QR avec Expo Go.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 12 },
  hint: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});



