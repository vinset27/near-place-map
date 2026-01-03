import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';

export default function OnboardingExperienceScreen() {
  const router = useRouter();
  const tint = usePrimaryTints();

  return (
    <PublicScaffold
      heroImage={require('../../assets/WunKOB566kMbkQlq75GNJHtJhQ.avif')}
      cardTitle="Explorez"
      onBack={() => router.back()}
    >
      <Text style={styles.text}>Explorez ce qui vous correspond, en temps réel.</Text>

      <Pressable onPress={() => router.push('/intent')} style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.9 }]}>
        <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
          <Text style={styles.ctaText}>Continuer</Text>
        </LinearGradient>
      </Pressable>
    </PublicScaffold>
  );
}

const styles = StyleSheet.create({
  text: { color: 'rgba(11,18,32,0.72)', fontSize: 13, fontWeight: '400', textAlign: 'center' },
  ctaWrap: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  cta: { alignItems: 'center', borderRadius: 999, paddingVertical: 14 },
  ctaText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});


