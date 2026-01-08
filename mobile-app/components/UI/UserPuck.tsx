import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function UserPuck(props?: { size?: number }) {
  const size = Math.max(34, Math.min(64, Number(props?.size || 44)));
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.05] });

  const inner = useMemo(() => {
    const s = size;
    return {
      outer: s,
      ring: Math.round(s * 0.86),
      core: Math.round(s * 0.46),
      dot: Math.round(s * 0.16),
    };
  }, [size]);

  return (
    <View style={{ width: inner.outer, height: inner.outer, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: inner.ring,
          height: inner.ring,
          borderRadius: 999,
          backgroundColor: 'rgba(37,99,235,0.22)',
          transform: [{ scale: ringScale }],
          opacity: ringOpacity as any,
        }}
      />

      <LinearGradient
        colors={['rgba(37,99,235,0.22)', 'rgba(37,99,235,0.10)']}
        style={{
          width: inner.ring,
          height: inner.ring,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(37,99,235,0.25)',
        }}
      >
        <LinearGradient
          colors={['#0b1220', '#2563eb']}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={{
            width: inner.core,
            height: inner.core,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View style={{ width: inner.dot, height: inner.dot, borderRadius: 999, backgroundColor: '#fff', opacity: 0.92 }} />
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}










