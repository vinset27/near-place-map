/**
 * Onboarding — PAGE 3 (Intention / Personnalisation légère)
 * Pas de formulaire: juste un choix, feedback immédiat, sauvegarde locale.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { OnboardingIntent, setOnboardingIntent, setOnboardingSeen } from '../../services/onboarding';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';

type Choice = { id: OnboardingIntent; label: string; emoji: string };

const CHOICES: Choice[] = [
  { id: 'discover', label: 'Découvrir', emoji: '🌍' },
  { id: 'meet', label: 'Rencontrer', emoji: '💬' },
  { id: 'explore', label: 'Explorer autour de moi', emoji: '📍' },
  { id: 'unique', label: 'Expériences uniques', emoji: '✨' },
];

export default function OnboardingIntentScreen() {
  const router = useRouter();
  const tint = usePrimaryTints();
  const [selected, setSelected] = useState<Set<OnboardingIntent>>(new Set());

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
    // Minimal flow: enter the app (map uses default location if permission isn't granted).
    router.replace('/map');
  };

  return (
    <PublicScaffold
      heroImage={require('../../assets/1_MTX5Z_3rxqD3s3CqxUXVyw.png')}
      cardTitle="Qu’est-ce qui vous attire aujourd’hui ?"
      onBack={() => router.back()}
    >
      <Text style={styles.sub}>Choisissez 1 ou plusieurs.</Text>

      <View style={styles.grid}>
        {CHOICES.map((c) => {
          const active = selected.has(c.id);
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
              <LinearGradient
                colors={active ? [tint.fieldB, tint.fieldA] : [tint.fieldA, tint.fieldA]}
                style={[styles.choice, active && styles.choiceActive]}
              >
                <Text style={styles.choiceEmoji}>{c.emoji}</Text>
                <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]} numberOfLines={2}>
                  {c.label}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={submit}
        disabled={disabled}
        style={({ pressed }) => [styles.ctaWrap, (disabled || pressed) && { opacity: disabled ? 0.55 : 0.9 }]}
      >
        <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
          <Text style={styles.ctaText}>Entrer dans l’application</Text>
        </LinearGradient>
      </Pressable>
    </PublicScaffold>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 2, color: 'rgba(11,18,32,0.60)', fontSize: 13, fontWeight: '400', textAlign: 'center' },
  grid: { marginTop: 14, gap: 12 },
  choice: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceActive: {
    // visual emphasis stays subtle (no hard borders)
  },
  choiceEmoji: { fontSize: 20 },
  choiceLabel: { flex: 1, fontSize: 14, fontWeight: '400', color: '#0b1220' },
  choiceLabelActive: { color: '#0b1220' },

  ctaWrap: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  cta: {
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 14,
  },
  ctaText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});


