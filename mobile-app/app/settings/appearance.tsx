import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../services/settingsTheme';
import { Divider, InlineToast, SettingsScreenShell, SettingsSection } from '../../components/Settings/SettingsPrimitives';
import { ThemeMode, TextSize, UiDensity, useSettingsStore } from '../../stores/useSettingsStore';

function ChoiceRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Text style={{ color: t.text, fontWeight: '900', transform: [{ scale: t.textScale }] }}>{label}</Text>
      <Text style={{ color: active ? t.primary : t.muted, fontWeight: '900' }}>{active ? '✓' : ''}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsAppearance() {
  const t = useAppTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const textSize = useSettingsStore((s) => s.textSize);
  const density = useSettingsStore((s) => s.density);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const setDensity = useSettingsStore((s) => s.setDensity);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(id);
  }, [toast]);

  const apply = (fn: () => void) => {
    fn();
    setToast('Appliqué.');
  };

  return (
    <SettingsScreenShell title="Appearance">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!!toast && <InlineToast text={toast} />}

        <SettingsSection title="Thème">
          <ChoiceRow label="Système" active={themeMode === 'system'} onPress={() => apply(() => setThemeMode('system' as ThemeMode))} />
          <Divider />
          <ChoiceRow label="Clair" active={themeMode === 'light'} onPress={() => apply(() => setThemeMode('light' as ThemeMode))} />
          <Divider />
          <ChoiceRow label="Sombre" active={themeMode === 'dark'} onPress={() => apply(() => setThemeMode('dark' as ThemeMode))} />
        </SettingsSection>

        <SettingsSection title="Texte">
          <ChoiceRow label="Normal" active={textSize === 'normal'} onPress={() => apply(() => setTextSize('normal' as TextSize))} />
          <Divider />
          <ChoiceRow label="Large" active={textSize === 'large'} onPress={() => apply(() => setTextSize('large' as TextSize))} />
          <Divider />
          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={{ color: t.muted, fontWeight: '800', lineHeight: 18 }}>
              Le changement s’applique immédiatement dans Settings (pas besoin de redémarrer).
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Densité UI">
          <ChoiceRow label="Standard" active={density === 'standard'} onPress={() => apply(() => setDensity('standard' as UiDensity))} />
          <Divider />
          <ChoiceRow label="Compact" active={density === 'compact'} onPress={() => apply(() => setDensity('compact' as UiDensity))} />
        </SettingsSection>
      </ScrollView>
    </SettingsScreenShell>
  );
}


