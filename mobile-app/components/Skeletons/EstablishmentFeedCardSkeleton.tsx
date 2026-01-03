import React from 'react';
import { View, StyleSheet } from 'react-native';

export function EstablishmentFeedCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cover} />
      <View style={styles.body}>
        <View style={styles.lineLg} />
        <View style={styles.lineMd} />
        <View style={styles.row}>
          <View style={styles.pill} />
          <View style={styles.pill} />
          <View style={{ flex: 1 }} />
          <View style={styles.pillSm} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  cover: { height: 170, backgroundColor: '#e2e8f0' },
  body: { padding: 12, gap: 10 },
  lineLg: { height: 14, borderRadius: 10, backgroundColor: '#e2e8f0', width: '70%' },
  lineMd: { height: 12, borderRadius: 10, backgroundColor: '#e2e8f0', width: '58%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { width: 92, height: 34, borderRadius: 14, backgroundColor: '#e2e8f0' },
  pillSm: { width: 40, height: 16, borderRadius: 10, backgroundColor: '#e2e8f0' },
});









