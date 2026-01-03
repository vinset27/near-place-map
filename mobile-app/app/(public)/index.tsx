import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getOnboardingSeen } from '../../services/onboarding';
import { PublicScaffold, usePrimaryTints } from '../../components/UI/PublicScaffold';

export default function OnboardingHeroScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const tint = usePrimaryTints();

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
  if (checking) return null;

  return (
    <PublicScaffold heroImage={require('../../assets/WunKOB566kMbkQlq75GNJHtJhQ.avif')} cardTitle="Near Place">
      <Text style={styles.subtitle}>Découvrez autrement ce qui vous entoure.</Text>

      <Pressable onPress={() => router.push('/experience')} style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.9 }]}>
        <LinearGradient colors={[tint.buttonA, tint.buttonB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
          <Text style={styles.ctaText}>Continuer</Text>
        </LinearGradient>
      </Pressable>
    </PublicScaffold>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: 'rgba(11,18,32,0.70)', fontSize: 13, fontWeight: '400', textAlign: 'center' },
  ctaWrap: { marginTop: 16, borderRadius: 999, overflow: 'hidden' },
  cta: { alignItems: 'center', borderRadius: 999, paddingVertical: 14 },
  ctaText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});


