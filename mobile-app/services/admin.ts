import api from './api';

function adminHeaders(token?: string) {
  const t = String(token || '').trim();
  return t ? { 'x-admin-token': t } : undefined;
}

function assertJsonResponse(data: any, ctx: string) {
  if (typeof data === 'string') {
    const s = data.trim();
    if (/^<!doctype html/i.test(s) || /^<html/i.test(s) || s.includes('<body') || s.includes('</html>')) {
      throw new Error(`${ctx}: Réponse HTML au lieu de JSON. Vérifie API_BASE_URL / déploiement backend.`);
    }
  }
  return data;
}

export type PendingModeration = {
  pending: {
    establishments?: any[];
    events: any[];
    userEvents: any[];
  };
  published?: {
    establishments?: any[];
    events?: any[];
    userEvents?: any[];
  };
};

export type AdminUserWithContent = {
  user: any;
  establishmentProfile?: any | null;
  counts: { establishments: number; events: number; userEvents: number };
  establishments: any[];
  events: any[];
  userEvents: any[];
};

export async function fetchPendingModeration(params?: { token?: string; limit?: number; includePublished?: boolean }): Promise<PendingModeration> {
  const res = await api.get('/api/admin/moderation/pending', {
    params: { limit: params?.limit ?? 200, includePublished: params?.includePublished ?? true, pubLimit: 120 },
    headers: adminHeaders(params?.token),
  });
  return assertJsonResponse(res.data, 'GET /api/admin/moderation/pending') as PendingModeration;
}

export async function fetchAdminUsersWithContent(params?: { token?: string; limit?: number; perUserLimit?: number }): Promise<{ users: AdminUserWithContent[] }> {
  const res = await api.get('/api/admin/users/with-content', {
    params: {
      limit: params?.limit ?? 200,
      perUserLimit: params?.perUserLimit ?? 30,
    },
    headers: adminHeaders(params?.token),
  });
  return assertJsonResponse(res.data, 'GET /api/admin/users/with-content') as { users: AdminUserWithContent[] };
}

export type AdminUserDetails = {
  user: any;
  establishmentProfile?: any | null;
  counts: { establishments: number; events: number; userEvents: number };
  establishments: any[];
  events: any[];
  userEvents: any[];
};

export async function fetchAdminUserDetails(
  id: string,
  params?: { token?: string; perTypeLimit?: number },
): Promise<AdminUserDetails> {
  const res = await api.get(`/api/admin/users/${encodeURIComponent(String(id))}/with-content`, {
    params: { perTypeLimit: params?.perTypeLimit ?? 120 },
    headers: adminHeaders(params?.token),
  });
  return assertJsonResponse(res.data, `GET /api/admin/users/${String(id)}/with-content`) as AdminUserDetails;
}

export async function approveProEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/events/${encodeURIComponent(id)}/approve`, {}, { headers: adminHeaders(token) });
}

export async function rejectProEvent(id: string, token?: string, reason?: string): Promise<void> {
  await api.post(
    `/api/admin/events/${encodeURIComponent(id)}/reject`,
    { reason: reason ? String(reason).slice(0, 260) : undefined },
    { headers: adminHeaders(token) },
  );
}

export async function approveUserEvent(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/user-events/${encodeURIComponent(id)}/approve`, {}, { headers: adminHeaders(token) });
}

export async function rejectUserEvent(id: string, token?: string, reason?: string): Promise<void> {
  await api.post(
    `/api/admin/user-events/${encodeURIComponent(id)}/reject`,
    { reason: reason ? String(reason).slice(0, 260) : undefined },
    { headers: adminHeaders(token) },
  );
}

export async function deleteEstablishment(id: string, token?: string): Promise<void> {
  await api.delete(`/api/admin/establishments/${encodeURIComponent(id)}`, { headers: adminHeaders(token) });
}

export async function deleteProEvent(id: string, token?: string): Promise<void> {
  await api.delete(`/api/admin/events/${encodeURIComponent(id)}`, { headers: adminHeaders(token) });
}

export async function deleteUserEvent(id: string, token?: string): Promise<void> {
  await api.delete(`/api/admin/user-events/${encodeURIComponent(id)}`, { headers: adminHeaders(token) });
}

export async function approveEstablishment(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/establishments/${encodeURIComponent(id)}/approve`, {}, { headers: adminHeaders(token) });
}

export async function rejectEstablishment(id: string, token?: string): Promise<void> {
  await api.post(`/api/admin/establishments/${encodeURIComponent(id)}/reject`, {}, { headers: adminHeaders(token) });
}

export async function setUserRole(login: string, role: 'user' | 'establishment' | 'admin', token?: string): Promise<any> {
  const res = await api.post(
    `/api/admin/users/set-role`,
    { login: String(login || '').trim(), role },
    { headers: adminHeaders(token) },
  );
  return (res.data as any)?.user;
}

export async function adminCreateUser(
  params: { email: string; password: string; role?: 'user' | 'establishment' | 'admin'; emailVerified?: boolean },
  token?: string,
): Promise<any> {
  const res = await api.post(
    `/api/admin/users`,
    {
      email: String(params.email || '').trim(),
      password: String(params.password || ''),
      role: params.role || 'user',
      emailVerified: params.emailVerified ?? false,
    },
    { headers: adminHeaders(token) },
  );
  return (res.data as any)?.user;
}

export async function resendTestEmail(to: string, token?: string): Promise<{ ok: boolean; id?: string | null }> {
  const email = String(to || '').trim().toLowerCase();
  const res = await api.post('/api/admin/resend/test', { to: email }, { headers: adminHeaders(token) });
  return res.data as any;
}





