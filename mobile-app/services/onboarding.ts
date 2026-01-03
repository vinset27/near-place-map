import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SEEN = 'nearplace:onboardingSeen:v1';
const KEY_INTENT = 'nearplace:onboardingIntent:v1';

export type OnboardingIntent = 'discover' | 'meet' | 'explore' | 'unique';

export async function getOnboardingSeen(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY_SEEN);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingSeen(seen: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SEEN, seen ? '1' : '0');
  } catch {
    // ignore
  }
}

export async function getOnboardingIntent(): Promise<OnboardingIntent[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INTENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set<OnboardingIntent>(['discover', 'meet', 'explore', 'unique']);
    const cleaned = parsed.map(String).filter((x) => allowed.has(x as any)) as OnboardingIntent[];
    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

export async function setOnboardingIntent(intent: OnboardingIntent[]): Promise<void> {
  try {
    const uniq = Array.from(new Set(intent));
    await AsyncStorage.setItem(KEY_INTENT, JSON.stringify(uniq));
  } catch {
    // ignore
  }
}









