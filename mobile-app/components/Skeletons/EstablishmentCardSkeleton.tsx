import React from 'react';
import { View, StyleSheet } from 'react-native';

export function EstablishmentCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.body}>
        <View style={styles.lineLg} />
        <View style={styles.row}>
          <View style={styles.badge} />
          <View style={styles.lineSm} />
        </View>
        <View style={styles.lineMd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  image: { width: 74, height: 74, borderRadius: 16, backgroundColor: '#e2e8f0' },
  body: { flex: 1, justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 92, height: 24, borderRadius: 999, backgroundColor: '#e2e8f0' },
  lineLg: { height: 14, borderRadius: 8, backgroundColor: '#e2e8f0', width: '86%' },
  lineMd: { height: 12, borderRadius: 8, backgroundColor: '#e2e8f0', width: '70%' },
  lineSm: { height: 12, borderRadius: 8, backgroundColor: '#e2e8f0', width: 66 },
});













