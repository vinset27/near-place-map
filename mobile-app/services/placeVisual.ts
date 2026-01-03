import type { EstablishmentCategory } from '../types/establishment';

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function getPlaceVisual(input: {
  id: string;
  name: string;
  category?: EstablishmentCategory | string | null;
}): { bg1: string; bg2: string; letter: string } {
  const seed = hash32(`${input.id}|${input.name}|${input.category ?? ''}`);
  const bg1 = pick(
    ['#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#64748b', '#fb7185', '#06b6d4', '#6366f1'],
    seed,
  );
  const bg2 = pick(['#111827', '#0b1220', '#052e16', '#3b0764', '#0f172a', '#1f2937', '#312e81', '#134e4a'], seed >>> 3);
  const first = Array.from((input.name || '?').trim())[0] || '?';
  const letter = String(first).toUpperCase();
  return { bg1, bg2, letter };
}












