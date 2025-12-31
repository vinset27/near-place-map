import { useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates } from '../types/establishment';
import { haversineDistance } from './location';

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Stabilize GPS origin for API queries to avoid refetching on tiny GPS jitter.
 * Mirrors the web strategy (threshold + time window + rounding).
 */
export function useStableQueryOrigin(input: Coordinates, opts?: { minMoveM?: number; minIntervalMs?: number }): Coordinates {
  const minMoveM = opts?.minMoveM ?? 35;
  const minIntervalMs = opts?.minIntervalMs ?? 8000;

  const [stable, setStable] = useState<Coordinates>(() => ({ lat: round4(input.lat), lng: round4(input.lng) }));
  const lastRef = useRef<{ t: number; loc: Coordinates } | null>(null);

  useEffect(() => {
    const now = Date.now();
    const last = lastRef.current;
    if (last) {
      const moved = haversineDistance(last.loc, input);
      // Only update when the user actually moved enough.
      if (moved < minMoveM) return;
      // Even if moved, don't update too frequently.
      if (now - last.t < minIntervalMs) return;
    }
    const next = { lat: round4(input.lat), lng: round4(input.lng) };
    lastRef.current = { t: now, loc: next };
    setStable(next);
  }, [input.lat, input.lng, input, minIntervalMs, minMoveM]);

  return useMemo(() => stable, [stable]);
}




