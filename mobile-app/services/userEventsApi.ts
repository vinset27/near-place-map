import api from './api';

export type UserEventKind = 'party' | 'meet';

export type ApiUserEvent = {
  id: string;
  createdAt: string;
  userId: string;
  kind: UserEventKind;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  lat: number;
  lng: number;
  published: boolean;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | string;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  distanceMeters?: number;
  organizer?: { userId: string; name: string };
};

export async function fetchUserEventsNearby(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  withinHours?: number;
  limit?: number;
}): Promise<ApiUserEvent[]> {
  const res = await api.get<{ userEvents?: ApiUserEvent[] }>('/api/user-events', { params });
  return (res.data?.userEvents || []) as ApiUserEvent[];
}

export async function fetchMyUserEvents(): Promise<ApiUserEvent[]> {
  const res = await api.get<{ userEvents?: ApiUserEvent[] }>('/api/user-events/me');
  return (res.data?.userEvents || []) as ApiUserEvent[];
}

export async function createUserEvent(input: {
  kind: UserEventKind;
  title: string;
  startsAt: string;
  endsAt?: string;
  description?: string;
  lat: number;
  lng: number;
}): Promise<ApiUserEvent> {
  const res = await api.post<{ userEvent: ApiUserEvent }>('/api/user-events', input);
  return res.data.userEvent as ApiUserEvent;
}

export async function deleteUserEvent(id: string): Promise<void> {
  await api.delete('/api/user-events/' + encodeURIComponent(id));
}





