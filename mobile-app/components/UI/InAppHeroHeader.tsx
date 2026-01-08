import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../services/settingsTheme';
import { usePrimaryTints } from './PublicScaffold';

export function InAppHeroHeader(props: {
  heroImage: any;
  title: string;
  subtitle?: string;
  badgeRight?: React.ReactNode;
  avatar?: React.ReactNode;
  primaryAction?: { label: string; onPress: () => void; disabled?: boolean };
  secondaryAction?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const tint = usePrimaryTints();

  const cardBg = t.isDark ? 'rgba(255,255,255,0.94)' : '#ffffff';
  const cardText = '#0b1220';

  return (
    <View style={styles.wrap}>
      <ImageBackground source={props.heroImage} resizeMode="cover" style={styles.hero}>
        <LinearGradient colors={['rgba(0,0,0,0)', tint.overlayB]} locations={[0.15, 1]} style={StyleSheet.absoluteFillObject} />
        <View style={{ height: Math.max(10, insets.top) }} />
        <View style={styles.heroCenter}>
          <Text style={styles.heroKicker}>Near Place</Text>
        </View>
      </ImageBackground>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={styles.row}>
          <View style={styles.avatar}>{props.avatar}</View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: cardText }]} numberOfLines={1}>
              {props.title}
            </Text>
            {!!props.subtitle && (
              <Text style={[styles.sub, { color: 'rgba(11,18,32,0.60)' }]} numberOfLines={1}>
                {props.subtitle}
              </Text>
            )}
          </View>
          {props.badgeRight ? <View style={styles.badgeRight}>{props.badgeRight}</View> : null}
        </View>

        <View style={styles.actions}>
          {props.primaryAction ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={props.primaryAction.onPress}
              disabled={props.primaryAction.disabled}
              style={[styles.btnWrap, props.primaryAction.disabled && { opacity: 0.6 }]}
            >
              <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                <Text style={styles.btnText}>{props.primaryAction.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          {props.secondaryAction ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={props.secondaryAction.onPress}
              disabled={props.secondaryAction.disabled}
              style={[styles.ghost, props.secondaryAction.disabled && { opacity: 0.55 }]}
            >
              <Text style={[styles.ghostText, { color: cardText }]}>{props.secondaryAction.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 10 },
  hero: { width: '100%', height: 190 },
  heroCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { color: '#fff', fontSize: 13, fontWeight: '400', letterSpacing: 0.4, opacity: 0.95 },

  card: {
    marginTop: -52,
    marginHorizontal: 14,
    borderRadius: 28,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 18, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '500' },
  sub: { marginTop: 2, fontSize: 12, fontWeight: '400' },
  badgeRight: { marginLeft: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnWrap: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  btn: { paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '500' },
  ghost: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(11,18,32,0.06)',
  },
  ghostText: { fontWeight: '400' },
});











