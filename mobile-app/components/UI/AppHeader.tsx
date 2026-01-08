import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../services/settingsTheme';

export function AppHeader(props: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={t.isDark ? ['#0b1220', '#0b2a6b'] : ['#0b1220', '#2563eb']} style={[styles.wrap, { paddingTop: Math.max(10, insets.top + 8) }]}>
      <View style={styles.row}>
        {!!props.onBack && (
          <TouchableOpacity onPress={props.onBack} activeOpacity={0.9} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
            {props.title}
          </Text>
          {!!props.subtitle && (
            <Text style={[styles.sub, { transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
              {props.subtitle}
            </Text>
          )}
        </View>
        {!!props.right && <View style={{ marginLeft: 10 }}>{props.right}</View>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  title: { color: '#fff', fontWeight: '950', fontSize: 18 },
  sub: { marginTop: 4, color: 'rgba(255,255,255,0.78)', fontWeight: '700', fontSize: 12 },
});







