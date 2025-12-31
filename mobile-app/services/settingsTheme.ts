import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { useSettingsStore, type ThemeMode, type TextSize, type UiDensity } from '../stores/useSettingsStore';

export type AppTheme = {
  isDark: boolean;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  danger: string;
  input: string;
  skeleton: string;
  textScale: number;
  pad: number;
};

function resolveMode(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

function scaleForTextSize(size: TextSize): number {
  return size === 'large' ? 1.08 : 1.0;
}

function padForDensity(density: UiDensity): number {
  return density === 'compact' ? 10 : 14;
}

export function useAppTheme(): AppTheme {
  const system = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const textSize = useSettingsStore((s) => s.textSize);
  const density = useSettingsStore((s) => s.density);

  return useMemo(() => {
    const resolved = resolveMode(themeMode, system);
    const isDark = resolved === 'dark';
    return {
      isDark,
      bg: isDark ? '#0b1220' : '#f8fafc',
      card: isDark ? '#0f172a' : '#ffffff',
      text: isDark ? '#ffffff' : '#0b1220',
      muted: isDark ? 'rgba(255,255,255,0.72)' : '#64748b',
      border: isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
      primary: '#2563eb',
      danger: '#ef4444',
      input: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
      skeleton: isDark ? 'rgba(255,255,255,0.10)' : '#e2e8f0',
      textScale: scaleForTextSize(textSize),
      pad: padForDensity(density),
    };
  }, [density, system, textSize, themeMode]);
}



