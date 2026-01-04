import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

export function VehiclePuck({
  headingDeg,
  mode,
  size = 44,
}: {
  headingDeg: number;
  mode: 'driving' | 'walking' | 'bicycling';
  size?: number;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [carUri, setCarUri] = useState<string | null>(null);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 520, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [pulse]);

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    a.start();
    return () => a.stop();
  }, [sweep]);

  useEffect(() => {
    // Load local SVG as a URI for SvgUri (no transformer needed).
    const asset = Asset.fromModule(require('../../assets/Car_031.svg'));
    asset
      .downloadAsync()
      .then(() => setCarUri(asset.localUri || asset.uri))
      .catch(() => setCarUri(asset.localUri || asset.uri));
  }, []);

  const iconName = useMemo(() => {
    if (mode === 'walking') return 'walk-outline';
    if (mode === 'bicycling') return 'bicycle-outline';
    return 'car-sport-outline';
  }, [mode]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const tilt = bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] });
  const heading = Number.isFinite(headingDeg) ? headingDeg : 0;

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.05] });
  const sweepRotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const ringColors = useMemo(() => {
    if (mode === 'walking') return ['#22c55e', '#a7f3d0'];
    if (mode === 'bicycling') return ['#f59e0b', '#fde68a'];
    return ['#7c3aed', '#ec4899']; // premium purple→pink
  }, [mode]);

  return (
    <Animated.View style={[styles.wrap, { width: size + 18, height: size + 18, transform: [{ translateY }] }]}>
      {/* soft glow halo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size + 26,
            height: size + 26,
            borderRadius: (size + 26) / 2,
            opacity: haloOpacity as any,
            transform: [{ scale: haloScale }],
            backgroundColor: mode === 'driving' ? 'rgba(124,58,237,0.55)' : mode === 'bicycling' ? 'rgba(245,158,11,0.50)' : 'rgba(34,197,94,0.50)',
          },
        ]}
      />

      {/* drop shadow */}
      <View style={[styles.shadow, Platform.OS === 'android' && { elevation: 10 }]} />

      {/* gradient ring */}
      <LinearGradient colors={ringColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ring, { borderRadius: (size + 10) / 2 }]}>
        {/* animated highlight sweep */}
        <Animated.View pointerEvents="none" style={[styles.sweepWrap, { transform: [{ rotate: sweepRotate }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sweep}
          />
        </Animated.View>

        {/* inner glass */}
        <LinearGradient
          colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.90)']}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.inner, { width: size, height: size, borderRadius: size / 2 }]}
        >
          {/* direction layer: rotates with heading */}
          <Animated.View style={{ transform: [{ rotate: `${heading}deg` }, { rotateZ: tilt }] }}>
            <View style={[styles.nose, { top: -8 }]} />
            {mode === 'driving' && carUri ? (
              <SvgUri uri={carUri} width={Math.round(size * 0.64)} height={Math.round(size * 0.64)} />
            ) : (
              <Ionicons name={iconName as any} size={Math.round(size * 0.54)} color="#0b1220" />
            )}
          </Animated.View>
          <View style={styles.dot} />
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  shadow: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  ring: {
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  sweepWrap: { position: 'absolute', left: -10, top: -10, right: -10, bottom: -10, opacity: 0.65 },
  sweep: { flex: 1, borderRadius: 999 },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.14)',
  },
  nose: {
    position: 'absolute',
    alignSelf: 'center',
    width: 10,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    opacity: 0.12,
  },
  dot: {
    position: 'absolute',
    bottom: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#fff',
  },
});


