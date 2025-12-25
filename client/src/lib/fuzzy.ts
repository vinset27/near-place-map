function stripDiacritics(s: string) {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

export function normalizeForSearch(input: string): string {
  const s = stripDiacritics(String(input || "").toLowerCase());
  // keep letters/digits/spaces, collapse spaces
  return s
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string, max: number) {
  // Early exits
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    let rowMin = v1[0];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      if (v1[j + 1] < rowMin) rowMin = v1[j + 1];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function fuzzyScore(queryRaw: string, hayRaw: string): number {
  const q = normalizeForSearch(queryRaw);
  const h = normalizeForSearch(hayRaw);
  if (!q) return 0;
  if (!h) return 0;

  // Exact substring match is strongest.
  const idx = h.indexOf(q);
  if (idx >= 0) {
    // Prefer earlier matches.
    return 1000 - idx * 2 - Math.max(0, h.length - q.length) * 0.05;
  }

  // Token prefix matches (good for partial typing).
  const qTokens = q.split(" ");
  const hTokens = h.split(" ");
  let prefixHits = 0;
  for (const qt of qTokens) {
    if (qt.length < 2) continue;
    if (hTokens.some((ht) => ht.startsWith(qt))) prefixHits++;
  }
  if (prefixHits > 0) {
    return 600 + prefixHits * 80 - (qTokens.length - prefixHits) * 30;
  }

  // Soft edit distance on the name-like part (cap work).
  const maxDist = Math.max(2, Math.min(6, Math.floor(q.length / 3)));
  const d = levenshtein(q, h.slice(0, Math.min(h.length, 64)), maxDist);
  if (d <= maxDist) {
    return 350 - d * 45;
  }

  return 0;
}



