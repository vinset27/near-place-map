import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [isConnected, setIsConnected] = React.useState(true);

  React.useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      // On iOS, s.isInternetReachable can be null initially; treat null as connected to avoid flicker.
      const ok = s.isConnected !== false && s.isInternetReachable !== false;
      setIsConnected(ok);
    });
    return () => sub();
  }, []);

  if (isConnected) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>Mode hors‑ligne • affichage du cache</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(11,18,32,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  text: { color: '#fff', fontWeight: '900', fontSize: 12 },
});





















