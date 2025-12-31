import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../services/settingsTheme';

export function SettingsScreenShell({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const t = useAppTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: t.input, borderColor: t.border }]}>
          <Text style={[styles.backText, { color: t.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text, transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 44, alignItems: 'flex-end' }}>{right || null}</View>
      </View>
      {children}
    </SafeAreaView>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const t = useAppTheme();
  return (
    <View style={[styles.searchWrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.searchIcon, { color: t.muted }]}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        style={[styles.searchInput, { color: t.text, transform: [{ scale: t.textScale }] }]}
        autoCapitalize="none"
      />
    </View>
  );
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useAppTheme();
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.sectionTitle, { color: t.muted, transform: [{ scale: t.textScale }] }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  disabled,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  const t = useAppTheme();
  const pressable = !!onPress && !disabled;
  return (
    <TouchableOpacity
      activeOpacity={pressable ? 0.9 : 1}
      onPress={onPress}
      disabled={!pressable}
      style={[styles.row, { opacity: disabled ? 0.55 : 1 }]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: t.input, borderColor: t.border }]}>
        <Text style={[styles.rowIcon]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.text, transform: [{ scale: t.textScale }] }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.rowSub, { color: t.muted, transform: [{ scale: t.textScale }] }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={{ marginLeft: 10, alignItems: 'flex-end' }}>
        {right ?? <Text style={{ color: t.muted, fontWeight: '900' }}>›</Text>}
      </View>
    </TouchableOpacity>
  );
}

export function Divider() {
  const t = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: t.border }]} />;
}

export function InlineToast({ text, tone }: { text: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const t = useAppTheme();
  const bg =
    tone === 'danger'
      ? 'rgba(239,68,68,0.12)'
      : tone === 'warn'
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(16,185,129,0.12)';
  const border =
    tone === 'danger'
      ? 'rgba(239,68,68,0.26)'
      : tone === 'warn'
      ? 'rgba(245,158,11,0.26)'
      : 'rgba(16,185,129,0.26)';
  return (
    <View style={[styles.toast, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.toastText, { color: t.text, transform: [{ scale: t.textScale }] }]}>{text}</Text>
    </View>
  );
}

export function SkeletonRow() {
  const t = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.skelIcon, { backgroundColor: t.skeleton }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skelLine, { width: '55%', backgroundColor: t.skeleton }]} />
        <View style={[styles.skelLine, { width: '82%', backgroundColor: t.skeleton }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 20, fontWeight: '900' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', fontSize: 16 },
  searchWrap: {
    marginTop: 12,
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: { fontWeight: '900' },
  searchInput: { flex: 1, fontWeight: '800' },
  // Section titles are intentionally more inset than the cards to feel “premium” and easier to scan.
  sectionTitle: {
    marginHorizontal: 22,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  sectionCard: { marginHorizontal: 14, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIconWrap: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { fontSize: 18 },
  rowTitle: { fontWeight: '900', fontSize: 14 },
  rowSub: { marginTop: 2, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  divider: { height: 1, opacity: 0.9 },
  toast: { marginHorizontal: 14, marginTop: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  toastText: { fontWeight: '850' },
  skelIcon: { width: 42, height: 42, borderRadius: 14 },
  skelLine: { height: 12, borderRadius: 10, opacity: 0.8 },
});


