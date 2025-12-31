import api from './api';

function adminHeaders(token?: string) {
  const t = String(token || '').trim();
  return t ? { 'x-admin-token': t } : undefined;
}

export type PendingModeration = {
  pending: {
    events: any[];
    userEvents: any[];
  };
};

export async function fetchPendingModeration(params?: { token?: string; limit?: number }): Promise<PendingModeration> {
  const res = await api.get('/api/admin/moderation/pending', {
    params: { limit: params?.limit ?? 200 },
    headers: adminHeaders(params?.token),
  });
  return res.data as PendingModeration;
}

export async function approveProEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/events/${encodeURIComponent(id)}/approve`, null, { headers: adminHeaders(token) });
}

export async function rejectProEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/events/${encodeURIComponent(id)}/reject`, null, { headers: adminHeaders(token) });
}

export async function approveUserEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/user-events/${encodeURIComponent(id)}/approve`, null, { headers: adminHeaders(token) });
}

export async function rejectUserEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/user-events/${encodeURIComponent(id)}/reject`, null, { headers: adminHeaders(token) });
}


