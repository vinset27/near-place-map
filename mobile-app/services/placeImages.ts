/**
 * Deterministic premium placeholder images (data-url SVG).
 * Ported from the web project to avoid external placeholder URLs.
 */

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

export function placeholderImageDataUrl(input: {
  id: string;
  name: string;
  category?: EstablishmentCategory | string | null;
}): string {
  const seed = hash32(`${input.id}|${input.name}|${input.category ?? ''}`);

  const bg = pick(
    ['#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#64748b', '#fb7185', '#06b6d4', '#6366f1'],
    seed,
  );
  const bg2 = pick(['#111827', '#0b1220', '#052e16', '#3b0764', '#0f172a', '#1f2937', '#312e81', '#134e4a'], seed >>> 3);

  const first = Array.from((input.name || '?').trim())[0] || '?';
  const letter = String(first).toUpperCase();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <circle cx="320" cy="180" r="96" fill="rgba(255,255,255,0.12)"/>
  <text x="320" y="205" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto" font-size="96" font-weight="800" fill="rgba(255,255,255,0.92)">${letter}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}












