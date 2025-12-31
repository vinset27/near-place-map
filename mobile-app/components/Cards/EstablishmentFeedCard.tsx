import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Establishment } from '../../types/establishment';
import { ESTABLISHMENT_CATEGORIES } from '../../types/establishment';
import { formatDistance } from '../../services/location';
import { PlaceImage } from '../UI/PlaceImage';
import { getPlaceFallbackImage } from '../../services/placeFallbackImage';
import { useAppTheme } from '../../services/settingsTheme';

function getCategoryMeta(categoryId: string): { label: string; color: string } {
  const c = ESTABLISHMENT_CATEGORIES.find((x) => x.id === categoryId);
  return { label: c?.label ?? categoryId, color: c?.color ?? '#2563eb' };
}

export const EstablishmentFeedCard = memo(function EstablishmentFeedCard(props: {
  item: Establishment;
  onPress: () => void;
  favorite?: { active: boolean; onToggle: () => void };
}) {
  const { item, onPress, favorite } = props;
  const t = useAppTheme();
  const meta = useMemo(() => getCategoryMeta(item.category), [item.category]);
  const distanceText = item.distanceMeters != null ? formatDistance(item.distanceMeters) : null;
  const cover = (item.photos && item.photos.length ? item.photos[0] : null) || item.imageUrl;
  const fallback = useMemo(() => getPlaceFallbackImage(item.category), [item.category]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.card, borderColor: t.border },
        pressed && { transform: [{ scale: 0.99 }] } as any,
      ]}
    >
      <View style={styles.media}>
        <PlaceImage uri={cover} fallbackSource={fallback} id={item.id} name={item.name} category={item.category} style={styles.cover} textSize={44} />
        <LinearGradient colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.72)']} style={styles.mediaShade} />

        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {meta.label}
            </Text>
          </View>
          {!!favorite && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                favorite.onToggle();
              }}
              style={({ pressed }) => [styles.heartBtn, pressed && { opacity: 0.85 }]}
              hitSlop={10}
            >
              <Text style={[styles.heartText, favorite.active && styles.heartTextActive]}>
                {favorite.active ? '♥' : '♡'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.avatarWrap}>
            <PlaceImage uri={cover} fallbackSource={fallback} id={`${item.id}-av`} name={item.name} category={item.category} style={styles.avatar} textSize={14} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {!!item.commune ? item.commune : item.address || '—'}
              {distanceText ? ` • ${distanceText}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.pill, { backgroundColor: t.isDark ? '#0b1220' : '#0b1220' }]}>
            <Text style={styles.pillText}>Détails</Text>
          </View>
          <View style={[styles.pillGhost, { borderColor: t.isDark ? 'rgba(37,99,235,0.28)' : 'rgba(37,99,235,0.20)' }]}>
            <Text style={[styles.pillGhostText, { color: t.primary }]}>Itinéraire</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[styles.rating, { color: t.text }]}>★ 4.5</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  media: { position: 'relative' },
  cover: { width: '100%', height: 170, backgroundColor: '#e2e8f0' },
  mediaShade: { ...StyleSheet.absoluteFillObject },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  badgeText: { color: '#fff', fontWeight: '950', fontSize: 11, textTransform: 'uppercase' },
  heartBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(11,18,32,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heartText: { color: 'rgba(255,255,255,0.82)', fontWeight: '900', fontSize: 16 },
  heartTextActive: { color: '#ef4444' },
  bottomRow: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  title: { color: '#fff', fontWeight: '950', fontSize: 16, letterSpacing: -0.2 },
  sub: { marginTop: 2, color: 'rgba(255,255,255,0.82)', fontWeight: '800', fontSize: 12 },
  body: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { backgroundColor: '#0b1220', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  pillText: { color: '#fff', fontWeight: '950', fontSize: 12 },
  pillGhost: { backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(37,99,235,0.20)' },
  pillGhostText: { color: '#2563eb', fontWeight: '950', fontSize: 12 },
  rating: { fontWeight: '950' },
});



