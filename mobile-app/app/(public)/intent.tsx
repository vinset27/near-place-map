/**
 * Onboarding — PAGE 3 (Intention / Personnalisation légère)
 * Pas de formulaire: juste un choix, feedback immédiat, sauvegarde locale.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { OnboardingIntent, setOnboardingIntent, setOnboardingSeen } from '../../services/onboarding';

type Choice = { id: OnboardingIntent; label: string; emoji: string };

const CHOICES: Choice[] = [
  { id: 'discover', label: 'Découvrir', emoji: '🌍' },
  { id: 'meet', label: 'Rencontrer', emoji: '💬' },
  { id: 'explore', label: 'Explorer autour de moi', emoji: '📍' },
  { id: 'unique', label: 'Expériences uniques', emoji: '✨' },
];

export default function OnboardingIntentScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<OnboardingIntent>>(new Set());

  const fade = useRef(new Animated.Value(0)).current;
  const up = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(up, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]).start();
  }, [fade, up]);

  const disabled = selected.size === 0;
  const selectedArr = useMemo(() => Array.from(selected), [selected]);

  const toggle = (id: OnboardingIntent) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    await setOnboardingIntent(selectedArr);
    await setOnboardingSeen(true);
    // Continue vers la suite du flow (permissions GPS), sans écran blanc.
    router.replace('/permissions');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#f8fafc', '#eef2ff', '#e0f2fe']} style={styles.bg}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: up }] }}>
          <Text style={styles.title}>Qu’est-ce qui vous attire aujourd’hui ?</Text>
          <Text style={styles.sub}>Choisissez 1 ou plusieurs.</Text>
        </Animated.View>

        <View style={styles.grid}>
          {CHOICES.map((c, idx) => {
            const active = selected.has(c.id);
            return (
              <AnimatedChoice
                key={c.id}
                delay={120 + idx * 80}
                active={active}
                label={c.label}
                emoji={c.emoji}
                onPress={() => toggle(c.id)}
              />
            );
          })}
        </View>

        <View style={styles.bottom}>
          <Pressable
            onPress={submit}
            disabled={disabled}
            style={({ pressed }) => [
              styles.cta,
              disabled && styles.ctaDisabled,
              pressed && !disabled && { opacity: 0.9 },
            ]}
          >
            <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>
              Entrer dans l’application
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function AnimatedChoice(props: {
  delay: number;
  active: boolean;
  label: string;
  emoji: string;
  onPress: () => void;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 520, delay: props.delay, useNativeDriver: true }).start();
  }, [appear, props.delay]);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: props.active ? 1.03 : 1,
      speed: 18,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [props.active, scale]);

  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale }] }}>
      <Pressable onPress={props.onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
        <LinearGradient
          colors={props.active ? ['rgba(37,99,235,0.18)', 'rgba(37,99,235,0.06)'] : ['#ffffff', '#ffffff']}
          style={[styles.choice, props.active && styles.choiceActive]}
        >
          <Text style={styles.choiceEmoji}>{props.emoji}</Text>
          <Text style={[styles.choiceLabel, props.active && styles.choiceLabelActive]} numberOfLines={2}>
            {props.label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  bg: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '950', color: '#0b1220', letterSpacing: -0.2, marginTop: 6 },
  sub: { marginTop: 8, color: '#64748b', fontSize: 13, fontWeight: '700' },
  grid: { marginTop: 18, gap: 12 },
  choice: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceActive: {
    borderColor: 'rgba(37,99,235,0.45)',
    shadowColor: '#2563eb',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  choiceEmoji: { fontSize: 20 },
  choiceLabel: { flex: 1, fontSize: 14, fontWeight: '900', color: '#0b1220' },
  choiceLabelActive: { color: '#2563eb' },
  bottom: { marginTop: 'auto' },
  cta: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#0b1220',
  },
  ctaDisabled: { backgroundColor: '#cbd5e1' },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  ctaTextDisabled: { color: '#475569' },
});


