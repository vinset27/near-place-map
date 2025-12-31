import api from './api';
import type { AuthUser } from './auth';

export type ProProfile = {
  userId: string;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  name: string;
  category: string;
  address?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  description?: string | null;
  avatarUrl?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  website?: string | null;
};

export type BusinessApplication = {
  id: string;
  createdAt: string;
  status: string;
  userId?: string | null;
  name: string;
  category: string;
  phone: string;
  description?: string | null;
  photos?: string[] | null;
  address?: string | null;
  commune?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export async function fetchMyBusinessApplications(): Promise<BusinessApplication[]> {
  const res = await api.get<{ applications?: BusinessApplication[] }>('/api/business/applications/me');
  return (res.data?.applications || []) as BusinessApplication[];
}

export async function fetchMyEstablishments(): Promise<any[]> {
  const res = await api.get<{ establishments?: any[] }>('/api/establishments/me');
  return (res.data?.establishments || []) as any[];
}

export async function fetchProProfile(): Promise<ProProfile | null> {
  const res = await api.get<{ profile?: ProProfile | null }>('/api/profile');
  return (res.data?.profile || null) as any;
}

export async function upsertProProfile(input: {
  ownerFirstName?: string;
  ownerLastName?: string;
  name: string;
  category: string;
  address?: string;
  phone?: string;
  lat: number;
  lng: number;
  description?: string;
  avatarUrl?: string;
  instagram?: string;
  whatsapp?: string;
  website?: string;
}): Promise<{ user: AuthUser; profile: ProProfile }> {
  const res = await api.post('/api/profile', input);
  return res.data as any;
}



