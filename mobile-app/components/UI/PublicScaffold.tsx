import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground, useWindowDimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../services/settingsTheme';

export type PrimaryTints = {
  fieldA: string;
  fieldB: string;
  buttonA: string;
  buttonB: string;
  overlayB: string;
};

export function usePrimaryTints(): PrimaryTints {
  const t = useAppTheme();
  return useMemo(() => {
    const hex = String(t.primary || '#2563eb').replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) || 37;
    const g = parseInt(hex.slice(2, 4), 16) || 99;
    const b = parseInt(hex.slice(4, 6), 16) || 235;
    const mix = (a: number) => {
      const rr = Math.round(255 + (r - 255) * a);
      const gg = Math.round(255 + (g - 255) * a);
      const bb = Math.round(255 + (b - 255) * a);
      return `rgb(${rr},${gg},${bb})`;
    };
    return {
      fieldA: mix(0.10),
      fieldB: mix(0.18),
      buttonA: mix(0.78),
      buttonB: t.primary,
      overlayB: t.primary,
    };
  }, [t.primary]);
}

export function PublicScaffold(props: {
  heroImage: any;
  welcomeText?: string;
  cardTitle: string;
  cardSubtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const tint = usePrimaryTints();

  // Keep the card visually higher (more overlap) — user feedback: "too low".
  const heroH = Math.max(240, Math.round(screenH * 0.44)); // ~45% target

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {/* Illustration zone */}
      <View style={[styles.heroWrap, { height: heroH }]}>
        <ImageBackground source={props.heroImage} resizeMode="cover" style={styles.heroImg}>
          <LinearGradient colors={['rgba(0,0,0,0)', tint.overlayB]} locations={[0.1, 1]} style={styles.heroOverlay} />

          {!!props.onBack && (
            <TouchableOpacity
              onPress={props.onBack}
              activeOpacity={0.9}
              style={[styles.backBtn, { top: Math.max(10, insets.top + 6) }]}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.heroCenter}>
            <Text style={styles.welcome}>{props.welcomeText ?? 'Bienvenue'}</Text>
          </View>
        </ImageBackground>
      </View>

      {/* Floating white card */}
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.cardTitle}>{props.cardTitle}</Text>
            <LinearGradient
              colors={[tint.buttonA, tint.buttonB]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.titleAccent}
            />
            {!!props.cardSubtitle && <Text style={styles.cardSub}>{props.cardSubtitle}</Text>}
          </View>
          {props.children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroWrap: { width: '100%' },
  heroImg: { flex: 1, width: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  welcome: { color: '#fff', fontSize: 18, fontWeight: '400', letterSpacing: 0.3 },

  backBtn: {
    position: 'absolute',
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },

  body: { flex: 1, backgroundColor: 'transparent' },
  card: {
    marginTop: -112,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 34,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardTitle: { textAlign: 'center', color: '#0b1220', fontSize: 26, fontWeight: '600', letterSpacing: -0.2 },
  titleAccent: { width: 64, height: 5, borderRadius: 999, marginTop: 10, marginBottom: 12 },
  cardSub: { marginTop: 2, color: 'rgba(11,18,32,0.55)', fontSize: 12, fontWeight: '400', textAlign: 'center' },
});


