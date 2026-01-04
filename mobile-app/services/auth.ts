import api from './api';

export type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  role?: string;
  profileCompleted?: boolean;
  emailVerified?: boolean;
};

export async function authMe(): Promise<AuthUser | null> {
  try {
    const res = await api.get('/api/auth/me');
    return res.data.user as AuthUser;
  } catch (e: any) {
    // Not logged in: treat as anonymous (avoid noisy errors in UI).
    if (e?.response?.status === 401) return null;
    throw e;
  }
}

export async function authRegister(params: { username: string; password: string }): Promise<AuthUser> {
  const res = await api.post('/api/auth/register', params);
  return res.data.user as AuthUser;
}

export async function authLogin(params: { username: string; password: string }): Promise<AuthUser> {
  const res = await api.post('/api/auth/login', params);
  return res.data.user as AuthUser;
}

export async function authLogout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export async function resendEmailVerification(): Promise<{ ok: boolean; alreadyVerified?: boolean }> {
  const res = await api.post('/api/auth/resend-verification');
  return res.data as any;
}

export async function verifyEmailCode(code: string): Promise<{ ok: boolean; alreadyVerified?: boolean; user?: AuthUser }> {
  const res = await api.post('/api/auth/verify-email-code', { code });
  return res.data as any;
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const res = await api.post('/api/auth/request-password-reset', { email });
  return res.data as any;
}

export async function resetPassword(params: { email: string; code: string; newPassword: string }): Promise<{ ok: boolean }> {
  const res = await api.post('/api/auth/reset-password', params);
  return res.data as any;
}

export async function changePassword(params: { currentPassword: string; newPassword: string }): Promise<{ ok: boolean }> {
  const res = await api.post('/api/auth/change-password', params);
  return res.data as any;
}

export async function requestPasswordChangeCode(): Promise<{ ok: boolean }> {
  const res = await api.post('/api/auth/request-password-change-code', {});
  return res.data as any;
}

export async function confirmPasswordChange(params: { code: string; newPassword: string }): Promise<{ ok: boolean }> {
  const res = await api.post('/api/auth/confirm-password-change', params);
  return res.data as any;
}

export async function deleteAccount(): Promise<{ ok: boolean; already?: boolean }> {
  const res = await api.post('/api/auth/delete-account', { confirm: 'DELETE' });
  return res.data as any;
}




