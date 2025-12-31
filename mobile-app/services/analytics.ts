import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const ANON_KEY = 'nearplace:anonId:v1';

function genAnonId(): string {
  // short, non-PII id to estimate unique visitors
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getAnonId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ANON_KEY);
  if (existing && existing.length >= 6) return existing;
  const next = genAnonId();
  await AsyncStorage.setItem(ANON_KEY, next);
  return next;
}

export async function trackEstablishmentView(input: { establishmentId: string; source?: string }): Promise<void> {
  const anonId = await getAnonId();
  await api.post(`/api/analytics/establishments/${encodeURIComponent(input.establishmentId)}/view`, {
    anonId,
    source: input.source || 'details',
  });
}

export type ProStats = {
  range7d: { views: number; visitors: number };
  range30d: { views: number; visitors: number };
  topEstablishments: Array<{ id: string; name: string; views: number; visitors: number }>;
};

export async function fetchProStats(): Promise<ProStats> {
  const res = await api.get('/api/pro/stats');
  return res.data as any;
}



