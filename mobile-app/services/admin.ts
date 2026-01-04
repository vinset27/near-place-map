import api from './api';

function adminHeaders(token?: string) {
  const t = String(token || '').trim();
  return t ? { 'x-admin-token': t } : undefined;
}

export type PendingModeration = {
  pending: {
    establishments?: any[];
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





