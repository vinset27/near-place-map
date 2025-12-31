/**
 * Onboarding — PAGE 1 (Hero)
 * Immersif, émotionnel, fluide.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getOnboardingSeen } from '../../services/onboarding';

const BG = require('../../assets/WunKOB566kMbkQlq75GNJHtJhQ.avif');
const IMG_RESTO = require('../../assets/restaurant-template.jpg');
const IMG_LOUNGE = require('../../assets/lounge.jpg');
const IMG_CLINIC = require('../../assets/clinique.jpg');
const AnimatedBg = Animated.createAnimatedComponent(ImageBackground);
const AnimatedImg = Animated.createAnimatedComponent(Image);
const { width: W } = Dimensions.get('window');

export default function OnboardingHeroScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const fade = useRef(new Animated.Value(0)).current;
  const up = useRef(new Animated.Value(10)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    getOnboardingSeen().then((seen) => {
      if (!alive) return;
      if (seen) {
        router.replace('/map');
        return;
      }
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (checking) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 720, useNativeDriver: true }),
      Animated.timing(up, { toValue: 0, duration: 720, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [checking, fade, pulse, up]);

  useEffect(() => {
    if (checking) return;
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    );
    driftLoop.start();
    return () => driftLoop.stop();
  }, [checking, drift]);

  useEffect(() => {
    if (checking) return;
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [checking, float]);

  const pulseStyle = useMemo(() => {
    const s = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
    return { transform: [{ scale: s }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) };
  }, [pulse]);

  const floatY = useMemo(() => float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }), [float]);
  const floatY2 = useMemo(() => float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }), [float]);
  const floatY3 = useMemo(() => float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }), [float]);

  return (
    <View style={styles.root}>
      <AnimatedBg
        source={BG}
        resizeMode="cover"
        blurRadius={2}
        style={[
          styles.bg,
          {
            transform: [
              {
                scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.08] }),
              },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
            ],
          },
        ]}
      >
        <LinearGradient colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.70)']} style={styles.overlay} />
        <LinearGradient colors={['rgba(37,99,235,0.00)', 'rgba(37,99,235,0.22)']} style={styles.blueGlow} />

        {/* Content (centered) */}
        <View style={styles.center}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: up }] }}>
            <View style={styles.brandPill}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>Near Place</Text>
            </View>
            <Text style={styles.title}>Découvrez autrement ce qui vous entoure</Text>
            <Text style={styles.subtitle}>Des expériences pensées pour vous, autour de vous.</Text>
          </Animated.View>
        </View>

        {/* Floating “preview” cards (demonstrative, not clickable) */}
        <View pointerEvents="none" style={styles.preview}>
          <Animated.View style={[styles.previewCard, { transform: [{ translateY: floatY }, { rotate: '-4deg' }] }]}>
            <AnimatedImg source={IMG_RESTO} style={styles.previewImg} />
            <View style={styles.previewMeta}>
              <Text style={styles.previewTitle}>Restaurant</Text>
              <Text style={styles.previewSub}>Autour de vous</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.previewCard, styles.previewCardMid, { transform: [{ translateY: floatY2 }] }]}>
            <AnimatedImg source={IMG_LOUNGE} style={styles.previewImg} />
            <View style={styles.previewMeta}>
              <Text style={styles.previewTitle}>Lounge</Text>
              <Text style={styles.previewSub}>Ambiance</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.previewCard, styles.previewCardRight, { transform: [{ translateY: floatY3 }, { rotate: '5deg' }] }]}>
            <AnimatedImg source={IMG_CLINIC} style={styles.previewImg} />
            <View style={styles.previewMeta}>
              <Text style={styles.previewTitle}>Services</Text>
              <Text style={styles.previewSub}>En un geste</Text>
            </View>
          </Animated.View>
        </View>

        {/* CTA bottom */}
        <View style={styles.bottom}>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Animated.View style={pulseStyle}>
            <Pressable
              onPress={() => router.push('/experience')}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Continuer</Text>
            </Pressable>
          </Animated.View>
        </View>
      </AnimatedBg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  blueGlow: { position: 'absolute', left: 0, right: 0, top: 0, height: 260 },
  center: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brandPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', marginBottom: 14 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#60a5fa' },
  brandText: { color: 'rgba(255,255,255,0.90)', fontWeight: '950', letterSpacing: 0.2 },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  preview: { position: 'absolute', left: 0, right: 0, bottom: 110, height: 220 },
  previewCard: {
    position: 'absolute',
    left: 18,
    width: Math.min(230, Math.round(W * 0.62)),
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  previewCardMid: { left: undefined as any, right: 18, top: 46 },
  previewCardRight: { left: Math.round(W * 0.20), top: 108, width: Math.min(220, Math.round(W * 0.58)) },
  previewImg: { width: '100%', height: 112, opacity: 0.9 },
  previewMeta: { padding: 12 },
  previewTitle: { color: '#fff', fontWeight: '950' },
  previewSub: { marginTop: 2, color: 'rgba(255,255,255,0.70)', fontWeight: '800', fontSize: 12 },
  bottom: { paddingHorizontal: 20, paddingBottom: 18, gap: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff' },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.2 },
});


