import api from './api';

export type UserTrip = {
  id: string;
  created_at: string;
  user_id: string;
  mode?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_type: 'establishment' | 'poi';
  establishment_id?: string | null;
  destination_name?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
};

export async function createTrip(params: {
  mode?: string;
  originLat?: number;
  originLng?: number;
  destinationType: 'establishment' | 'poi';
  establishmentId?: string;
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
}) {
  const res = await api.post('/api/trips', params);
  return res.data as any;
}

export async function fetchMyTrips(params?: { limit?: number }): Promise<UserTrip[]> {
  const res = await api.get('/api/trips/me', { params: { limit: params?.limit ?? 120 } });
  return (res.data as any)?.trips || [];
}


