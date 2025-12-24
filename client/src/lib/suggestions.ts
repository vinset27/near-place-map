import type { Establishment } from "@/lib/data";
import { fuzzyScore, normalizeForSearch } from "@/lib/fuzzy";
import { ESTABLISHMENT_CATEGORIES } from "@/lib/categories";

const categoryLabel = new Map<string, string>(
  ESTABLISHMENT_CATEGORIES.map((c) => [String(c.id), c.label]),
);

export type EstablishmentSuggestion = {
  id: string;
  name: string;
  category: Establishment["category"];
  categoryLabel: string;
  commune: string;
  address: string;
  imageUrl: string;
  score: number;
};

export function rankEstablishmentSuggestions(
  query: string,
  establishments: Establishment[],
  limit = 8,
): EstablishmentSuggestion[] {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];

  const out: EstablishmentSuggestion[] = [];
  for (const e of establishments) {
    const catLabel = categoryLabel.get(String(e.category)) || String(e.category);
    const hay = `${e.name} ${e.commune || ""} ${e.address || ""} ${catLabel}`;
    const score = fuzzyScore(q, hay);
    if (score <= 0) continue;
    out.push({
      id: e.id,
      name: e.name,
      category: e.category,
      categoryLabel: catLabel,
      commune: e.commune || "",
      address: e.address || "",
      imageUrl: e.imageUrl,
      score,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, Math.max(1, Math.min(12, limit)));
}


