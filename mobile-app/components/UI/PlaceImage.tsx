import React, { memo, useMemo, useState } from 'react';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlaceVisual } from '../../services/placeVisual';

function isRenderableImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  const u = String(uri).trim();
  if (!u) return false;
  // React Native Image does not reliably render svg data-urls without extra libs.
  if (u.startsWith('data:image/')) return !u.startsWith('data:image/svg');
  return (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('file://') ||
    u.startsWith('content://') || // Android local URIs
    u.startsWith('ph://') // iOS local URIs
  );
}

export const PlaceImage = memo(function PlaceImage(props: {
  uri?: string | null;
  fallbackSource?: ImageSourcePropType;
  id: string;
  name: string;
  category?: string | null;
  style?: StyleProp<ViewStyle>;
  textSize?: number;
}) {
  const { uri, fallbackSource, id, name, category, style, textSize = 28 } = props;
  const [failed, setFailed] = useState(false);
  const canUse = useMemo(() => isRenderableImageUri(uri) && !failed, [failed, uri]);
  const v = useMemo(() => getPlaceVisual({ id, name, category }), [id, name, category]);

  if (canUse) {
    return (
      <Image
        source={{ uri: String(uri) }}
        style={[styles.base, style]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallbackSource) {
    return <Image source={fallbackSource} style={[styles.base, style]} resizeMode="cover" />;
  }

  return (
    <LinearGradient colors={[v.bg1, v.bg2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.base, style]}>
      <View style={styles.glow} />
      <Text style={[styles.letter, { fontSize: textSize }]}>{v.letter}</Text>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  base: { backgroundColor: '#e2e8f0', overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.14)',
    top: -20,
    left: -20,
  },
  letter: { color: 'rgba(255,255,255,0.92)', fontWeight: '900', fontSize: 28 },
});


