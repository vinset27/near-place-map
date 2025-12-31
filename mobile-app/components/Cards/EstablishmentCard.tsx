import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Establishment, ESTABLISHMENT_CATEGORIES } from '../../types/establishment';
import { formatDistance } from '../../services/location';
import { PlaceImage } from '../UI/PlaceImage';
import { getPlaceFallbackImage } from '../../services/placeFallbackImage';
import { useAppTheme } from '../../services/settingsTheme';

type Variant = 'list' | 'map';

function getCategoryMeta(categoryId: string): { label: string; color: string } {
  const c = ESTABLISHMENT_CATEGORIES.find((x) => x.id === categoryId);
  return { label: c?.label ?? categoryId, color: c?.color ?? '#2563eb' };
}

export const EstablishmentCard = memo(function EstablishmentCard(props: {
  item: Establishment;
  variant?: Variant;
  onPress: () => void;
  onClose?: () => void;
  favorite?: { active: boolean; onToggle: () => void };
}) {
  const { item, variant = 'list', onPress, onClose, favorite } = props;
  const t = useAppTheme();
  const meta = useMemo(() => getCategoryMeta(item.category), [item.category]);
  const distanceText = item.distanceMeters != null ? formatDistance(item.distanceMeters) : null;
  const fallback = useMemo(() => getPlaceFallbackImage(item.category), [item.category]);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: t.card, borderColor: t.border },
        variant === 'map' && styles.cardMap,
        variant === 'map' && { backgroundColor: t.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.96)' },
      ]}
    >
      <PlaceImage
        uri={item.imageUrl}
        fallbackSource={fallback}
        id={item.id}
        name={item.name}
        category={item.category}
        style={[styles.image, variant === 'map' && styles.imageMap]}
      />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: t.text, transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
            {item.name}
          </Text>
          {!!favorite && (
            <TouchableOpacity
              onPress={favorite.onToggle}
              style={[styles.iconBtn, { backgroundColor: t.input, borderColor: t.border }, favorite.active && styles.iconBtnActive]}
              hitSlop={10}
            >
              <Text style={[styles.iconText, { color: t.muted }, favorite.active && styles.iconTextActive]}>{favorite.active ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          )}
          {!!onClose && (
            <TouchableOpacity onPress={onClose} style={[styles.iconBtn, { backgroundColor: t.input, borderColor: t.border }]} hitSlop={10}>
              <Text style={[styles.iconText, { color: t.muted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {meta.label}
            </Text>
          </View>
          {distanceText && <Text style={[styles.metaText, { color: t.primary, transform: [{ scale: t.textScale }] }]}>{distanceText}</Text>}
        </View>

        <Text style={[styles.sub, { color: t.muted, transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
          {item.address ? item.address : 'Adresse non renseignée'}
          {!!item.commune ? ` • ${item.commune}` : ''}
        </Text>

        {variant === 'map' && (
          <View style={styles.ctaRow}>
            <View style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText}>Voir les détails</Text>
            </View>
            <View style={styles.ctaGhost}>
              <Text style={styles.ctaGhostText}>Itinéraire</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardMap: {
    // backgroundColor is overridden at runtime depending on theme
    borderColor: 'rgba(226,232,240,0.9)',
  },
  image: { width: 74, height: 74, borderRadius: 16, backgroundColor: '#e2e8f0' },
  imageMap: { width: 66, height: 66, borderRadius: 16 },
  body: { flex: 1, minHeight: 74, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontWeight: '950', fontSize: 15 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnActive: { backgroundColor: 'rgba(239,68,68,0.10)' },
  iconText: { color: '#64748b', fontWeight: '900' },
  iconTextActive: { color: '#ef4444' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },
  metaText: { fontWeight: '900', fontSize: 12 },
  sub: { color: '#64748b', fontWeight: '700', fontSize: 12, marginTop: 6 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  ctaPrimary: { flex: 1, backgroundColor: '#0b1220', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  ctaPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  ctaGhost: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostText: { color: '#2563eb', fontWeight: '900', fontSize: 12 },
});


