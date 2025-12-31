/**
 * Onboarding — PAGE 2 (Expérience / Aperçu fonctionnel)
 * On montre sans expliquer: “vivant”, fluide, premium.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const IMG_RESTO = require('../../assets/restaurant-template.jpg');
const IMG_LOUNGE = require('../../assets/lounge.jpg');
const IMG_CAVES = require('../../assets/caves.jpg');
const AnimatedImg = Animated.createAnimatedComponent(Image);

export default function OnboardingExperienceScreen() {
  const router = useRouter();

  const wave = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0.98)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const cards = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(wave, { toValue: 1, duration: 3800, useNativeDriver: true }),
    );
    loop.start();

    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 4200, useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 4200, useNativeDriver: true }),
      ]),
    );
    shineLoop.start();
    Animated.timing(cards, { toValue: 1, duration: 900, delay: 180, useNativeDriver: true }).start();
    return () => {
      loop.stop();
      shineLoop.stop();
    };
  }, [cards, fade, shine, wave, zoom]);

  const pin1 = useMemo(() => {
    const y = wave.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
    const o = wave.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] });
    return { opacity: o, transform: [{ translateY: y }] };
  }, [wave]);
  const pin2 = useMemo(() => {
    const y = wave.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
    const o = wave.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });
    return { opacity: o, transform: [{ translateY: y }] };
  }, [wave]);
  const card = useMemo(() => {
    const y = wave.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
    const o = wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.95, 0.95] });
    return { opacity: o, transform: [{ translateY: y }] };
  }, [wave]);

  const stack = useMemo(() => {
    const x = cards.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
    const o = cards.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    return { opacity: o, transform: [{ translateX: x }] };
  }, [cards]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070b14', '#0b2a6b', '#111827']} style={styles.bg}>
        <Animated.View style={[styles.stage, { opacity: fade, transform: [{ scale: zoom }] }]}>
          {/* Fake “carte” */}
          <View style={styles.map}>
            <View style={styles.grid} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shine,
                {
                  opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.12] }),
                  transform: [
                    {
                      translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] }),
                    },
                    { rotate: '-12deg' },
                  ],
                },
              ]}
            />

            <Animated.View style={[styles.pin, styles.pinA, pin1]}>
              <View style={styles.pinDot} />
              <View style={styles.pinStem} />
            </Animated.View>

            <Animated.View style={[styles.pin, styles.pinB, pin2]}>
              <View style={[styles.pinDot, { backgroundColor: '#22c55e' }]} />
              <View style={styles.pinStem} />
            </Animated.View>

            <Animated.View style={[styles.card, card]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.lineStrong} />
                  <View style={styles.lineSoft} />
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.badge} />
                <View style={styles.badge} />
              </View>
            </Animated.View>

            {/* Floating cards “live UI” */}
            <Animated.View style={[styles.floatStack, stack]} pointerEvents="none">
              <View style={[styles.fCard, { top: 28, left: 18 }]}>
                <AnimatedImg source={IMG_RESTO} style={styles.fImg} />
                <View style={styles.fMeta}>
                  <Text style={styles.fTitle}>Restaurant</Text>
                  <Text style={styles.fSub}>À 1.2 km</Text>
                </View>
              </View>
              <View style={[styles.fCard, { top: 96, right: 18 }]}>
                <AnimatedImg source={IMG_LOUNGE} style={styles.fImg} />
                <View style={styles.fMeta}>
                  <Text style={styles.fTitle}>Lounge</Text>
                  <Text style={styles.fSub}>Live</Text>
                </View>
              </View>
              <View style={[styles.fCard, { top: 166, left: 24 }]}>
                <AnimatedImg source={IMG_CAVES} style={styles.fImg} />
                <View style={styles.fMeta}>
                  <Text style={styles.fTitle}>Cave</Text>
                  <Text style={styles.fSub}>Promo</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={styles.text}>Explorez ce qui vous correspond, en temps réel.</Text>
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={() => router.push('/intent')}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Voir plus</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070b14' },
  bg: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  stage: { flex: 1, justifyContent: 'center' },
  map: {
    height: 420,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  floatStack: { ...StyleSheet.absoluteFillObject },
  fCard: {
    position: 'absolute',
    width: 160,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  fImg: { width: '100%', height: 76, opacity: 0.92 },
  fMeta: { padding: 10 },
  fTitle: { color: '#fff', fontWeight: '950', fontSize: 12 },
  fSub: { marginTop: 2, color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 11 },
  shine: {
    position: 'absolute',
    top: -40,
    left: -80,
    width: 220,
    height: 520,
    backgroundColor: '#ffffff',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  pin: { position: 'absolute', alignItems: 'center' },
  pinA: { top: 110, left: 80 },
  pinB: { top: 180, right: 90 },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#60a5fa', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  pinStem: { width: 2, height: 12, backgroundColor: 'rgba(255,255,255,0.65)', marginTop: 2, borderRadius: 1 },
  card: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  lineStrong: { height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.45)', width: '70%' },
  lineSoft: { marginTop: 8, height: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.20)', width: '46%' },
  cardFooter: { marginTop: 14, flexDirection: 'row', gap: 10 },
  badge: { height: 26, flex: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  textWrap: { paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  bottom: { paddingTop: 6 },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.2 },
});


