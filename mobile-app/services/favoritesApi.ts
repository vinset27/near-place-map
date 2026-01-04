import api from './api';

export async function setFavorite(params: { establishmentId: string; active: boolean }): Promise<{ ok: boolean }> {
  const id = String(params.establishmentId || '').trim();
  const res = await api.post(`/api/favorites/${encodeURIComponent(id)}`, { active: !!params.active });
  return res.data as any;
}

export async function getFavorites(): Promise<{ favorites: Array<{ establishment_id: string; created_at: string }> }> {
  const res = await api.get('/api/favorites');
  return res.data as any;
}



