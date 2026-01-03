import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EstablishmentEvent } from './events';

const KEY = 'nearplace:userEvents:v1';

export type UserEvent = EstablishmentEvent & {
  createdAt: string; // ISO
};

function safeParse(raw: string | null): UserEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as UserEvent[];
  } catch {
    return [];
  }
}

export async function listUserEvents(): Promise<UserEvent[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const items = safeParse(raw);
  // newest first
  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function addUserEvent(input: Omit<UserEvent, 'id' | 'createdAt'>): Promise<UserEvent> {
  const raw = await AsyncStorage.getItem(KEY);
  const items = safeParse(raw);
  const ev: UserEvent = {
    ...input,
    id: `ue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [ev, ...items].slice(0, 200);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return ev;
}

export async function deleteUserEvent(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const items = safeParse(raw);
  const next = items.filter((x) => String(x.id) !== String(id));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}









